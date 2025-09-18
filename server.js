// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { dbConnect, Member, Data } = require('./lib/db');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));

// ------------------------ 유틸 ------------------------
function getMaxHP(user) {
  let maxHP = 120;
  for (let i = 1; i <= (user.레벨 || 1) - 1; i++) {
    maxHP += Math.floor((i + 2) ** 2 * 10);
  }
  return maxHP;
}
function getMaxMP(user) {
  let maxMP = 50;
  for (let i = 1; i <= (user.레벨 || 1) - 1; i++) {
    maxMP += Math.floor((i + 2) * 20);
  }
  return maxMP;
}
function safeNumber(n, d = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : d;
}

// ------------------------ 로그인 ------------------------
app.post('/api/login', async (req, res) => {
  await dbConnect();
  const { username, password } = req.body || {};
  try {
    const member = await Member.findOne({ username });
    if (!member || member.password !== password) {
      return res.status(401).json({ success: false, message: "아이디 또는 비밀번호가 올바르지 않습니다." });
    }
    let memberData = {};
    const dataDoc = await Data.findOne({ username });
    if (dataDoc && dataDoc.data) {
      memberData = { ...dataDoc.data, username, password: member.password };
    } else {
      memberData = { username, password: member.password };
    }
    return res.json({ success: true, data: memberData });
  } catch (err) {
    console.error("로그인 중 DB 오류:", err);
    return res.status(500).json({ success: false, message: "DB 오류 발생." });
  }
});

// ------------------------ 저장/회원가입 (비번 완화) ------------------------
app.post('/api/save', async (req, res) => {
  await dbConnect();
  const memberData = req.body || {};
  const isNew = !!memberData.isNewRegistration;

  // ✅ 비밀번호 조건 완화: 최소 4자만
  if (typeof memberData.password !== 'string' || memberData.password.length < 4) {
    return res.status(400).json({
      success: false,
      message: "비밀번호는 최소 4자 이상이어야 합니다."
    });
  }

  if (isNew) {
    try {
      const existingMember = await Member.findOne({ username: memberData.username });
      if (existingMember) {
        return res.status(400).json({ success: false, message: "이미 회원가입이 완료되었습니다." });
      }
    } catch (err) {
      console.error("회원 체크 오류:", err);
      return res.status(500).json({ success: false, message: "회원 체크 오류 발생." });
    }
  }

  try {
    await Member.updateOne(
      { username: memberData.username },
      { $set: { password: memberData.password } },
      { upsert: true }
    );
  } catch (err) {
    console.error("회원정보 업데이트 오류:", err);
    return res.status(500).json({ success: false, message: "회원정보 업데이트 오류 발생." });
  }

  try {
    const result = await Data.updateOne(
      { username: memberData.username },
      { $set: { data: memberData } },
      { upsert: true }
    );
    if (result.upsertedCount > 0) {
      console.log(`회원 데이터 삽입 완료: ${memberData.username}`);
    } else {
      console.log(`회원 데이터 업데이트 완료: ${memberData.username}`);
    }
    return res.json({ success: true });
  } catch (err) {
    console.error("게임 데이터 업데이트 오류:", err);
    return res.status(500).json({ success: false, message: "게임 데이터 업데이트 오류 발생." });
  }
});

// ------------------------ PvP (인메모리) ------------------------
const pvpQueue = []; // [username]
const pvpMatches = new Map(); // matchId -> match

function findMatchByUser(username) {
  for (const [mid, m] of pvpMatches) {
    if (m.players.includes(username)) return [mid, m];
  }
  return [null, null];
}

function createMatch(u1, u2, snapshot1, snapshot2) {
  const matchId = crypto.randomBytes(8).toString('hex');
  const base1 = {
    username: u1,
    레벨: safeNumber(snapshot1.레벨, 1),
    공격력: safeNumber(snapshot1.공격력, 10),
    방어력: safeNumber(snapshot1.방어력, 0),
    명중률: safeNumber(snapshot1.명중률, 0.8),
    속도: safeNumber(snapshot1.속도, 10),
    체력: getMaxHP(snapshot1),
    MP: getMaxMP(snapshot1),
    장착장비: Array.isArray(snapshot1.장착장비) ? snapshot1.장착장비.slice(0, 4) : [],
    배운특수능력: Array.isArray(snapshot1.배운특수능력) ? snapshot1.배운특수능력.slice(0, 8) : []
  };
  const base2 = {
    username: u2,
    레벨: safeNumber(snapshot2.레벨, 1),
    공격력: safeNumber(snapshot2.공격력, 10),
    방어력: safeNumber(snapshot2.방어력, 0),
    명중률: safeNumber(snapshot2.명중률, 0.8),
    속도: safeNumber(snapshot2.속도, 10),
    체력: getMaxHP(snapshot2),
    MP: getMaxMP(snapshot2),
    장착장비: Array.isArray(snapshot2.장착장비) ? snapshot2.장착장비.slice(0, 4) : [],
    배운특수능력: Array.isArray(snapshot2.배운특수능력) ? snapshot2.배운특수능력.slice(0, 8) : []
  };

  const match = {
    matchId,
    players: [u1, u2],
    state: 'active',
    snapshot: { [u1]: base1, [u2]: base2 },
    buffs: { [u1]: {}, [u2]: {} }, // 콤보/차지/회피/역습/취약 등
    actions: { [u1]: null, [u2]: null }, // {type, skillName?}
    turn: 1,
    lastLog: []
  };
  pvpMatches.set(matchId, match);
  return match;
}

// 매칭 대기열 등록
app.post('/api/pvp/queue', async (req, res) => {
  await dbConnect();
  const { username } = req.body || {};
  if (!username) return res.status(400).json({ success: false, message: 'username 필요' });

  // 이미 매치 중?
  const [existingId, existing] = findMatchByUser(username);
  if (existing) return res.json({ success: true, status: 'matched', matchId: existingId, opponent: existing.players.find(p => p !== username) });

  // 이미 큐에?
  if (!pvpQueue.includes(username)) pvpQueue.push(username);

  // 매칭 시도
  if (pvpQueue.length >= 2) {
    const u1 = pvpQueue.shift();
    const u2 = pvpQueue.shift();

    // 스냅샷 로드
    const d1 = await Data.findOne({ username: u1 });
    const d2 = await Data.findOne({ username: u2 });
    const s1 = (d1 && d1.data) ? d1.data : { username: u1, 레벨: 1, 공격력: 10, 방어력: 0, 명중률: 0.8, 속도: 10 };
    const s2 = (d2 && d2.data) ? d2.data : { username: u2, 레벨: 1, 공격력: 10, 방어력: 0, 명중률: 0.8, 속도: 10 };

    const match = createMatch(u1, u2, s1, s2);
    return res.json({ success: true, status: 'matched', matchId: match.matchId, opponent: u1 === username ? u2 : u1, turn: match.turn });
  }

  return res.json({ success: true, status: 'queued' });
});

// 상태 조회
app.get('/api/pvp/status', (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ success: false, message: 'username 필요' });
  const [mid, match] = findMatchByUser(username);
  if (!match) {
    const queued = pvpQueue.includes(username);
    return res.json({ success: true, status: queued ? 'queued' : 'idle' });
  }
  const me = username;
  const you = match.players.find(p => p !== me);
  const my = match.snapshot[me];
  const op = match.snapshot[you];
  return res.json({
    success: true,
    status: match.state,
    matchId: mid,
    opponent: you,
    turn: match.turn,
    you: { hp: my.체력, mp: my.MP },
    opp: { hp: op.체력, mp: op.MP },
    lastLog: match.lastLog.slice(-6)
  });
});

// 행동 제출 및 해석
app.post('/api/pvp/action', (req, res) => {
  const { username, matchId, action, skillName } = req.body || {};
  const match = pvpMatches.get(matchId);
  if (!match || match.state !== 'active') return res.status(400).json({ success: false, message: '유효하지 않은 매치' });
  if (!match.players.includes(username)) return res.status(403).json({ success: false, message: '참가자가 아님' });

  // 기록
  match.actions[username] = { type: String(action || '').trim(), skillName: skillName ? String(skillName) : undefined };

  // 두 사람 다 제출하면 라운드 판정
  const [u1, u2] = match.players;
  if (match.actions[u1] && match.actions[u2]) {
    const a1 = match.actions[u1];
    const a2 = match.actions[u2];
    const s1 = match.snapshot[u1];
    const s2 = match.snapshot[u2];
    const b1 = match.buffs[u1] || {};
    const b2 = match.buffs[u2] || {};

    function resolveAttack(attacker, defender, atkAction, atkBuffs, defBuffs) {
      let attackMultiplier = 1.0;
      let defendMultiplier = 1.0;
      let dmg = Math.round(safeNumber(attacker.공격력, 10) * attackMultiplier - safeNumber(defender.방어력, 0) * 0.5);
      if (atkAction === '공격') attackMultiplier = 1.2;
      if (atkAction === '방어') attackMultiplier = 0.5, defendMultiplier = 1.5;
      if (atkAction === '차지') { atkBuffs.차지 = 1; return { dmg: 0, log: `${attacker.username}이(가) 차지하여 다음 공격을 강화합니다.` }; }
      if (atkAction === '회피') { atkBuffs.회피 = 1; return { dmg: 0, log: `${attacker.username}이(가) 회피태세에 들어갑니다.` }; }

      // 콤보
      atkBuffs.콤보 = (atkBuffs.콤보 || 0) + (atkAction === '공격' ? 1 : 0);
      const comboMul = 1 + Math.min(5, atkBuffs.콤보 || 0) * 0.1;

      // 차지 적용
      let chargeMul = 1.0;
      if (atkBuffs.차지) { chargeMul = 2.0; delete atkBuffs.차지; defBuffs.취약 = 1; }

      // 상대 취약
      const weakMul = defBuffs.취약 ? 1.25 : 1.0;

      // 역습
      const ripMul = atkBuffs.역습 ? 1.35 : 1.0;
      if (atkBuffs.역습) delete atkBuffs.역습;

      // 기본 명중
      let hitChance = safeNumber(attacker.명중률, 0.8) + safeNumber(attacker.속도, 0) * 0.01 - safeNumber(defender.속도, 0) * 0.01;
      if (defBuffs.회피) hitChance -= 0.35;

      if (Math.random() > Math.max(0.05, Math.min(0.95, hitChance))) {
        return { dmg: 0, log: `${attacker.username}의 공격이 빗나갔습니다.` };
      }

      dmg = Math.round((safeNumber(attacker.공격력, 10) * (atkAction === '공격' ? 1.2 : 1.0) - safeNumber(defender.방어력, 0) * 0.5) * comboMul * chargeMul * weakMul * ripMul);
      dmg = Math.max(dmg, 0);

      // 상대가 회피중이면 0 데미지 + 역습 부여
      if (defBuffs.회피) {
        defBuffs.회피 = 0;
        atkBuffs.콤보 = 0;
        defBuffs.역습 = 1;
        return { dmg: 0, log: `${defender.username}의 회피 성공! 역습 기회 획득.` };
      }

      return { dmg, log: `${attacker.username}의 공격: ${dmg} 피해` };
    }

    // 특수는 간단 처리(기술명/MP만 소모, 1.6배)
    function resolveSpecial(attacker, defender, atkBuffs, defBuffs, skillName) {
      if (!Array.isArray(attacker.배운특수능력)) return { dmg: 0, log: `${attacker.username}은(는) 사용할 특수 능력이 없습니다.` };
      const skill = attacker.배운특수능력.find(s => s && s.이름 === skillName);
      if (!skill) return { dmg: 0, log: `${attacker.username}의 특수 실패(스킬 없음)` };
      const cost = safeNumber(skill.MP소모, 10);
      if (attacker.MP < cost) return { dmg: 0, log: `${attacker.username}의 특수 실패(MP 부족)` };
      attacker.MP -= cost;

      let hitChance = safeNumber(skill.명중률, 0.9);
      if (Math.random() > hitChance) return { dmg: 0, log: `${attacker.username}의 특수 "${skill.이름}"이(가) 빗나갔습니다.` };

      // 단순 강공격 취급
      const base = Math.round(safeNumber(attacker.공격력, 10) * 1.6 - safeNumber(defender.방어력, 0) * 0.4);
      const weakMul = defBuffs.취약 ? 1.25 : 1.0;
      const ripMul = atkBuffs.역습 ? 1.35 : 1.0;
      if (atkBuffs.역습) delete atkBuffs.역습;
      let dmg = Math.round(Math.max(0, base) * weakMul * ripMul);
      if (defBuffs.회피) { defBuffs.회피 = 0; atkBuffs.콤보 = 0; defBuffs.역습 = 1; dmg = 0; }
      return { dmg, log: `${attacker.username}의 특수 "${skill.이름}": ${dmg} 피해` };
    }

    function applyAction(user, act, opp, buffsU, buffsO) {
      if (!act || !act.type) return { dmg: 0, log: `${user.username} 행동 없음` };
      const t = act.type;
      if (t === '공격' || t === '일반' || t === '방어' || t === '회피' || t === '차지') return resolveAttack(user, opp, t, buffsU, buffsO);
      if (t.startsWith('특수')) return resolveSpecial(user, opp, buffsU, buffsO, act.skillName);
      return { dmg: 0, log: `${user.username}의 알 수 없는 행동` };
    }

    // 해석 순서: 동시에 처리하되 회피/차지는 선처리 로그만
    const r1 = a1.type.startsWith('특수')
      ? resolveSpecial(s1, s2, b1, b2, a1.skillName)
      : applyAction(s1, a1, s2, b1, b2);
    const r2 = a2.type.startsWith('특수')
      ? resolveSpecial(s2, s1, b2, b1, a2.skillName)
      : applyAction(s2, a2, s1, b2, b1);

    s2.체력 = Math.max(0, s2.체력 - safeNumber(r1.dmg));
    s1.체력 = Math.max(0, s1.체력 - safeNumber(r2.dmg));

    match.lastLog.push(`[턴 ${match.turn}] ${r1.log}`);
    match.lastLog.push(`[턴 ${match.turn}] ${r2.log}`);

    // 종료 체크
    if (s1.체력 <= 0 && s2.체력 <= 0) match.state = 'draw';
    else if (s1.체력 <= 0) match.state = `win:${s2.username}`;
    else if (s2.체력 <= 0) match.state = `win:${s1.username}`;
    else match.turn += 1;

    // 다음 턴 준비
    match.actions[u1] = null;
    match.actions[u2] = null;

    return res.json({
      success: true,
      state: match.state,
      turn: match.turn,
      you: { hp: s1.체력, mp: s1.MP },
      opp: { hp: s2.체력, mp: s2.MP },
      lastLog: match.lastLog.slice(-6)
    });
  }

  // 아직 상대 미제출
  return res.json({ success: true, state: 'waiting' });
});

// 큐 나가기 / 항복
app.post('/api/pvp/leave', (req, res) => {
  const { username } = req.body || {};
  if (!username) return res.status(400).json({ success: false, message: 'username 필요' });

  const idx = pvpQueue.indexOf(username);
  if (idx >= 0) pvpQueue.splice(idx, 1);

  const [mid, match] = findMatchByUser(username);
  if (match && match.state === 'active') {
    const other = match.players.find(p => p !== username);
    match.state = `win:${other}`;
    match.lastLog.push(`[시스템] ${username}이(가) 항복/이탈했습니다. ${other} 승리!`);
  }
  return res.json({ success: true });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

module.exports = app;