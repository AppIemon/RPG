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

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

module.exports = app;
