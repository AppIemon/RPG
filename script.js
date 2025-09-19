// script.js (오프라인 전용 · tactics.json 연동 · 전술 1% 드롭)

// 상태 공유
let currentSender = null;

const Game = {
  currentCommandKey: null,
  mapCache: {},
  monsterCache: {},
  equipmentCache: [],
  skillCache: [],
  tacticsCache: [],
  variables: {
    회원: {},
    game: {}
  },
  commands: {
    // ───────────────── 회원/세션 ─────────────────
    "회원가입": {
      params: ["username", "password"],
      출력: async (sender, params) => {
        if (params.length < 2) return "사용자 이름과 비밀번호를 입력하세요. 예: 회원가입 | 이름 | 비밀번호";
        const username = params[0];
        const password = params[1];

        const memberData = {
          username,
          password,
          isNewRegistration: true,
          코인: 0,
          경험치: 0,
          레벨: 1,
          소유장비: [],
          장착장비: [],
          스토리: 0,
          위치: "시작의 마을",
          세부위치: "마을 입구",
          방문: ["시작의 마을"],
          세부방문: [],
          스토리진행중: true,
          스토리인덱스: 0,
          체력: 100,
          공격력: 10,
          방어력: 0,
          속도: 10,
          pendingDecision: null,
          MP: 50,
          마왕패배: false,
          명중률: 0.8,
          퀘스트완료: {},
          보스스토리완료: false,
          배운특수능력: [],
          배운전술: [] // ← 전술 보유 목록
        };

        // 등록
        Game.variables.회원[username] = memberData;
        Game.functions._saveUser(memberData);
        currentSender = username;

        // 가입 환영/스토리 시작
        const mapData = await Game.variables.game.지도;
        const storyArr = mapData?.["시작의 마을"]?.["마을 입구"]?.스토리;
        return Array.isArray(storyArr) && storyArr.length > 0
          ? storyArr[0]
          : `${username}님, 회원가입이 완료되었습니다!`;
      }
    },
    "로그인": {
      params: ["username", "password"],
      출력: async (sender, params) => {
        const username = params[0];
        const password = params[1];
        const saved = Game.functions._loadUser(username);
        if (!saved) return "존재하지 않는 사용자입니다.";
        if (saved.password !== password) return "비밀번호가 올바르지 않습니다.";
        Game.variables.회원[username] = saved;
        currentSender = username;
        return `${username}님, 로그인 성공!`;
      }
    },

    // ───────────────── 기본 정보/이동 ─────────────────
    "상태": {
      params: [],
      출력: (sender) => {
        const u = Game.variables.회원[sender];
        if (!u) return "로그인 후 이용해주세요.";
        let status = `${sender}님의 상태\n`;
        status += `잔액: ${Game.functions.formatNumber(u.코인)}\n`;
        status += `체력: ${Game.functions.formatNumber(u.체력)} / ${Game.functions.formatNumber(Game.functions.getMaxHP(u))}\n`;
        status += `MP: ${Game.functions.formatNumber(u.MP)} / ${Game.functions.formatNumber(Game.functions.getMaxMP(u))}\n`;
        status += `공격력: ${Game.functions.formatNumber(u.공격력)}\n`;
        status += `경험치: ${Game.functions.formatNumber(u.경험치)}\n`;
        status += `레벨: ${u.레벨}\n`;
        status += `소유 장비: ${u.소유장비.length ? u.소유장비.join(', ') : '없음'}\n`;
        status += `장착 장비: ${u.장착장비.length ? u.장착장비.join(', ') : '없음'}\n`;
        status += `현재 위치: ${u.위치} / ${u.세부위치}\n`;
        status += `퀘스트 완료: ${Object.keys(u.퀘스트완료).length ? Object.keys(u.퀘스트완료).join(', ') : '없음'}\n`;
        status += `보유 기술(특수): ${u.배운특수능력?.length ? u.배운특수능력.map(s=>s.이름).join(', ') : '없음'}\n`;
        status += `보유 전술: ${u.배운전술?.length ? u.배운전술.map(t=>t.이름).join(', ') : '없음'}`;
        return status;
      }
    },
    "다음": {
      params: [],
      출력: async (sender) => {
        const mapData = await Game.variables.game.지도;
        const u = Game.variables.회원[sender];
        const locData = mapData?.[u.위치]?.[u.세부위치];
        if (!locData || !Array.isArray(locData.스토리)) {
          u.스토리진행중 = false;
          return "진행할 스토리가 없습니다.";
        }
        const storyArr = locData.스토리;
        u.스토리인덱스++;
        if (u.스토리인덱스 < storyArr.length) {
          return storyArr[u.스토리인덱스];
        } else {
          u.스토리진행중 = false;
          const locationKey = `${u.위치}_${u.세부위치}`;
          if (!u.세부방문.includes(locationKey)) u.세부방문.push(locationKey);
          let finishMessage = "스토리 완료.";
          if (u.위치 === "시작의 마을" && u.세부위치 === "무기 상점") {
            if (!u.소유장비.includes("마을의 검")) {
              u.소유장비.push("마을의 검");
              finishMessage += " 무기 대장장이가 '마을의 검'을 지급하였습니다.";
            }
          }
          const bossRooms = ["나무 오두막","마왕의 방","모래 폭풍의 사막","유적의 사막","열기의 사막","잃어버린 사막","바람의 산길","얼음 산길","불꽃 산길","잃어버린 산길","진흙 늪","연못의 습지","안개 늪","수초의 습지","상류","중류","하류","투명한 바다","깊은 바다","폭풍의 바다","어둠의 바다","새벽 하늘","구름 하늘","수성","금성","화성","목성","토성","천왕성","해왕성","폐허의 세계"];
          if (bossRooms.includes(u.세부위치)) {
            u.보스스토리완료 = true;
            finishMessage += " 보스 스토리가 완료되었습니다.";
          }
          return finishMessage;
        }
      }
    },
    "이동": {
      params: ["세부위치"],
      getChoices: (sender) => {
        const mapData = Game.mapCache || {};
        const u = Game.variables.회원[sender];
        const currentLocation = mapData?.[u.위치]?.[u.세부위치];
        const choices = [];
        if (currentLocation?.연결) {
          currentLocation.연결.forEach(conn => {
            if (typeof conn === "string") choices.push(conn);
            else if (typeof conn === "object") choices.push(conn.sub);
          });
        }
        return choices;
      },
      출력: async (sender, params) => {
        const mapData = await Game.variables.game.지도;
        const u = Game.variables.회원[sender];
        const currentLocation = mapData?.[u.위치]?.[u.세부위치];
        if (!currentLocation) return `현재 위치 (${u.위치}, ${u.세부위치})의 지도 데이터가 없습니다.`;

        const bossCheckMsg = Game.functions.보스확인(sender, u.세부위치);
        if (bossCheckMsg) return bossCheckMsg;

        if (!currentLocation.연결 || currentLocation.연결.length === 0) {
          return "이동할 수 있는 연결된 장소가 없습니다.";
        }
        const destination = params[0];
        if (!destination) {
          const moves = currentLocation.연결.map(conn => (typeof conn === "string" ? conn : conn.sub));
          return `이동할 장소를 지정해주세요.\n이동 가능한 장소: ${moves.join(", ")}`;
        }
        let allowed = null;
        for (let conn of currentLocation.연결) {
          if (typeof conn === "string") {
            if (conn === destination) { allowed = { main: u.위치, sub: destination }; break; }
          } else if (typeof conn === "object") {
            if (conn.sub === destination) { allowed = conn; break; }
          }
        }
        if (!allowed) return `현재 위치에서 "${destination}"(으)로 이동할 수 없습니다.`;
        u.위치 = allowed.main;
        u.세부위치 = allowed.sub;
        if (!u.방문.includes(allowed.main)) u.방문.push(allowed.main);
        const locationKey = `${u.위치}_${u.세부위치}`;
        if (!u.세부방문.includes(locationKey)) {
          u.세부방문.push(locationKey);
          u.스토리진행중 = true;
          u.스토리인덱스 = 0;
          const locationData = mapData?.[u.위치]?.[u.세부위치];
          if (locationData?.스토리?.length > 0) return locationData.스토리[u.스토리인덱스];
          return `"${allowed.sub}"(으)로 이동하였습니다. (스토리 데이터 없음)`;
        }
        return `"${allowed.sub}"(으)로 이동하였습니다."`;
      }
    },
    "지도": {
      params: [],
      출력: async (sender) => {
        const mapData = await Game.variables.game.지도;
        const u = Game.variables.회원[sender];
        const currentLocation = mapData?.[u.위치]?.[u.세부위치];
        if (!currentLocation) return `현재 위치 (${u.위치}, ${u.세부위치})의 지도 데이터가 없습니다.`;
        if (!Array.isArray(currentLocation.연결) || currentLocation.연결.length === 0) {
          return `현재 ${u.위치}에서 이동할 수 있는 장소가 없습니다.`;
        }
        const moves = currentLocation.연결.map(conn => (typeof conn === "string" ? conn : `(${conn.main}) ${conn.sub}`));
        return `현재 ${u.위치}에서 이동 가능한 장소: ${moves.join(", ")}`;
      }
    },

    // ───────────────── 탐험/전투 ─────────────────
    "탐험": {
      params: [],
      출력: async (sender, params) => {
        const u = Game.variables.회원[sender];
        if (!u) return `${sender}님, 먼저 회원가입을 진행해주세요.`;

        if (u.pendingDecision && u.pendingDecision.type === "탐험전투") {
          if (params.length > 0) {
            const answer = params[0].trim().toLowerCase();
            if (answer === "예" || answer === "yes") {
              const battle = {
                type: "턴전투",
                monster: u.pendingDecision.monster,
                monsterHP: u.pendingDecision.monsterHP,
                initiative: "player",
                specialUsed: false,
                confirmedWithNormal: true,
                buffs: { user: {}, monster: {} }
              };
              u.pendingDecision = battle;
              return `${battle.monster.이름}과의 전투를 시작합니다! 플레이어가 선공입니다. 전투 진행은 "공격", "일반", "방어", "전술", "특수" 명령어를 사용하세요.`;
            } else if (answer === "아니오" || answer === "no") {
              u.pendingDecision = null;
              return "전투를 취소하고 탐험을 계속합니다.";
            } else {
              return "올바른 입력이 아닙니다. '예' 또는 '아니오'를 입력해주세요.";
            }
          } else {
            return `${u.pendingDecision.monster.이름}을(를) 발견하였습니다. 전투를 시작하시겠습니까? (예/아니오)`;
          }
        }

        const chance = Math.random();

        if (chance < 0.10) {
          if (u.위치 === "마왕의 성") {
            const mapData = await Game.variables.game.지도;
            const currentFloor = u.세부위치;
            const connections = mapData?.["마왕의 성"]?.[currentFloor]?.연결;
            let nextFloor = null;
            if (Array.isArray(connections)) {
              for (let conn of connections) {
                if (conn?.main === "마왕의 성" && conn?.sub) { nextFloor = conn.sub; break; }
              }
            }
            if (nextFloor) {
              u.세부위치 = nextFloor;
              return `축하합니다! 다음 층으로 이동합니다: 마왕의 성 ${nextFloor}`;
            } else {
              return "더 이상의 층이 존재하지 않습니다.";
            }
          } else {
            return "주변에 특별한 변화는 없습니다.";
          }
        }

        if (chance < 0.60) {
          const monstersData = await Game.variables.game.몬스터;
          const monsters = monstersData?.[u.위치]?.[u.세부위치] || [];
          if (monsters.length === 0) return "주변에 적이 없어 탐험을 계속합니다.";
          const monster = monsters[Math.floor(Math.random() * monsters.length)];
          const battle = {
            type: "턴전투",
            monster,
            monsterHP: monster.체력,
            initiative: "monster",
            specialUsed: false,
            buffs: { user: {}, monster: {} }
          };
          u.pendingDecision = battle;
          return Game.functions.턴전투진행(sender, "일반");
        }

        const monstersData = await Game.variables.game.몬스터;
        const monsters = monstersData?.[u.위치]?.[u.세부위치] || [];
        if (monsters.length === 0) return "주변에 적이 없어 탐험을 계속합니다.";
        const monster = monsters[Math.floor(Math.random() * monsters.length)];
        u.pendingDecision = {
          type: "턴전투",
          monster,
          monsterHP: monster.체력,
          initiative: "player",
          specialUsed: false,
          awaitingConfirmation: true,
          buffs: { user: {}, monster: {} }
        };
        return `${monster.이름}을(를) 발견했습니다. 전투를 시작하시겠습니까? (예/아니오)`;
      }
    },
    "공격": {
      params: [],
      출력: (sender) => {
        if (Game.variables.회원[sender]?.pendingDecision?.type === "턴전투") {
          return Game.functions.턴전투진행(sender, "공격");
        }
        return "현재 진행 중인 전투가 없습니다.";
      }
    },
    "일반": {
      params: [],
      출력: (sender) => {
        if (Game.variables.회원[sender]?.pendingDecision?.type === "턴전투") {
          return Game.functions.턴전투진행(sender, "일반");
        }
        return "현재 진행 중인 전투가 없습니다.";
      }
    },
    "방어": {
      params: [],
      출력: (sender) => {
        if (Game.variables.회원[sender]?.pendingDecision?.type === "턴전투") {
          return Game.functions.턴전투진행(sender, "방어");
        }
        return "현재 진행 중인 전투가 없습니다.";
      }
    },
    "전술": {
      params: ["전술명"],
      getChoices: (sender) => {
        const u = Game.variables.회원[sender];
        if (!u?.배운전술?.length) return ["보유 전술 없음"];
        return u.배운전술.map(t => t.이름);
      },
      출력: (sender, params) => {
        if (!(Game.variables.회원[sender]?.pendingDecision?.type === "턴전투")) return "전투 중에만 사용할 수 있습니다.";
        const name = (params[0] || "").trim();
        if (!name) return "사용할 전술명을 입력하세요.";
        return Game.functions.턴전투진행(sender, `전술 ${name}`);
      }
    },
    "특수": {
      params: ["스킬명"],
      getChoices: (sender) => {
        const u = Game.variables.회원[sender];
        if (!u?.배운특수능력?.length) return ["보유한 스킬이 없습니다."];
        return u.배운특수능력.map(s => s.이름);
      },
      출력: (sender, params) => {
        if (!(Game.variables.회원[sender]?.pendingDecision?.type === "턴전투")) return "전투 중에만 사용할 수 있습니다.";
        const name = (params[0] || "").trim();
        if (!name) return "사용할 특수 능력명을 입력하세요.";
        return Game.functions.턴전투진행(sender, `특수 ${name}`);
      }
    },

    // ───────────────── 상점/장비/숙박 ─────────────────
    "구매": {
      params: ["장비이름"],
      getChoices: (sender) => {
        const equipments = Game.equipmentCache || [];
        const u = Game.variables.회원[sender];
        if (u.세부위치 === "무기 상점") {
          return equipments.filter(eq => eq.판매마을 === u.위치).map(eq => eq.이름);
        }
        return [];
      },
      출력: async (sender, params) => {
        const u = Game.variables.회원[sender];
        const availableEquipments = await Game.variables.game.장비;

        if (!params[0]) {
          const equipmentList = u.세부위치 === "무기 상점"
            ? availableEquipments.filter(eq => eq.판매마을 === u.위치)
            : [];
          if (equipmentList.length === 0) return `현재 ${u.위치}에서는 구매 가능한 장비가 없습니다.`;
          let listStr = "구매 가능한 장비 목록:\n";
          equipmentList.forEach(eq => {
            listStr += `${eq.이름} - 가격: ${Game.functions.formatNumber(eq.cost)} 코인`;
            if (eq.특수능력) listStr += ` (특수능력: ${eq.특수능력.이름})`;
            listStr += "\n";
          });
          return listStr;
        }

        const equipmentName = params[0];
        let equipment = null;
        if (u.세부위치 === "무기 상점") {
          equipment = availableEquipments.find(eq => eq.이름 === equipmentName && eq.판매마을 === u.위치);
        }
        if (!equipment) return `장비 상점에 ${equipmentName}은(는) 존재하지 않습니다.`;
        if (u.코인 < equipment.cost) return `잔액이 부족합니다. ${Game.functions.formatNumber(equipment.cost)} 코인이 필요합니다.`;

        u.코인 -= equipment.cost;
        u.소유장비.push(equipment.이름);
        return `${equipment.이름} 구매 완료! 남은 코인: ${Game.functions.formatNumber(u.코인)}`;
      }
    },
    "장착": {
      params: ["장비이름"],
      getChoices: (sender) => Game.variables.회원[sender].소유장비,
      출력: async (sender, params) => {
        const u = Game.variables.회원[sender];
        const equipmentName = params[0];
        if (!u.소유장비.includes(equipmentName)) return `${equipmentName}을(를) 소유하고 있지 않습니다.`;
        if (u.장착장비[0] === equipmentName) return `${equipmentName}은(는) 이미 장착되어 있습니다.`;
        if (u.장착장비.length > 0 && u.장착장비[0] !== equipmentName) u.장착장비 = [];

        const equipmentList = await Game.variables.game.장비;
        const equipment = equipmentList.find(eq => eq.이름 === equipmentName);
        if (!equipment) return `${equipmentName}을(를) 찾을 수 없습니다.`;

        // 능력 문자열 → 함수 변환 (옵션)
        if (equipment.능력) {
          let abilityFn;
          if (typeof equipment.능력 === 'object' && equipment.능력.능력) {
            if (typeof equipment.능력.능력 === 'string') {
              abilityFn = (0, eval)(equipment.능력.능력);
              equipment.능력.능력 = abilityFn;
            }
          } else if (typeof equipment.능력 === 'string') {
            abilityFn = (0, eval)(equipment.능력);
            equipment.능력 = abilityFn;
          }
        }

        u.장착장비.push(equipmentName);
        return `${equipmentName}이(가) 장착되었습니다.`;
      }
    },
    "숙박": {
      params: [],
      출력: (sender) => {
        const u = Game.variables.회원[sender];
        if (u.세부위치 !== "여관") return "현재 위치에는 여관이 없습니다.";
        const cost = 20;
        if (u.코인 < cost) return `숙박에는 ${Game.functions.formatNumber(cost)} 코인이 필요합니다. 현재 코인: ${Game.functions.formatNumber(u.코인)}`;
        u.코인 -= cost;
        const maxHP = Game.functions.getMaxHP(u);
        const maxMP = Game.functions.getMaxMP(u);
        u.체력 = maxHP;
        u.MP = maxMP;
        return `숙박료 ${Game.functions.formatNumber(cost)} 코인을 지불하였습니다. 체력과 MP가 완전히 회복되었습니다. (HP: ${Game.functions.formatNumber(maxHP)}, MP: ${Game.functions.formatNumber(maxMP)})`;
      }
    },

    // ───────────────── 보스 ─────────────────
    "보스와 전투": {
      params: [],
      출력: async (sender) => {
        const mapData = await Game.variables.game.지도;
        const u = Game.variables.회원[sender];
        const locationData = mapData?.[u.위치]?.[u.세부위치];
        if (!locationData || !locationData.보스) return "현재 위치에서는 보스 전투를 진행할 수 없습니다.";

        const bossName = locationData.보스;
        const bossDatabase = await fetch("./game/boss.json").then(r=>r.json()).catch(()=> ({}));
        const bossData = bossDatabase[bossName];
        if (!bossData) return "현재 위치의 보스 정보가 누락되었습니다.";

        let bossStory = "";
        if (locationData.스토리 && Array.isArray(locationData.스토리)) {
          bossStory = locationData.스토리.join("\n") + "\n";
        }

        const boss = { 이름: bossName, ...bossData, 스토리: bossStory };
        u.pendingDecision = {
          type: "턴전투",
          isBoss: true,
          monster: boss,
          monsterHP: boss.체력,
          initiative: "player",
          specialUsed: false,
          buffs: { user: {}, monster: {} }
        };

        return boss.스토리
          ? boss.스토리 + `${boss.이름}과의 보스 전투가 시작됩니다!`
          : `${boss.이름}과의 보스 전투가 시작됩니다!`;
      }
    },

    // ───────────────── 저장 ─────────────────
    "저장": {
      params: [],
      출력: (sender) => {
        const u = Game.variables.회원[sender];
        if (!u) return "로그인 상태가 아닙니다.";
        Game.functions._saveUser(u);
        return "게임 데이터가 로컬에 저장되었습니다.";
      }
    },

    // ───────────────── 의사결정 ─────────────────
    "예": {
      params: [],
      출력: (sender) => {
        const u = Game.variables.회원[sender];
        const pend = u?.pendingDecision;
        if (!pend) return "현재 결정할 사항이 없습니다.";
        if (pend.type === "턴전투" && pend.awaitingConfirmation) {
          pend.awaitingConfirmation = false;
          return Game.functions.턴전투진행(sender, "일반");
        }
        return "확인할 항목이 없습니다.";
      }
    },
    "아니오": {
      params: [],
      출력: (sender) => {
        const u = Game.variables.회원[sender];
        const pend = u?.pendingDecision;
        if (!pend) return "현재 결정할 사항이 없습니다.";
        if (pend.type === "턴전투" && pend.awaitingConfirmation) {
          u.pendingDecision = null;
          return "전투를 취소하고 탐험을 계속합니다.";
        }
        u.pendingDecision = null;
        return "취소되었습니다.";
      }
    }
  },

  // ───────────────── 내부 함수 ─────────────────
  functions: {
    회원확인: (sender) => !!Game.variables.회원[sender],

    레벨업확인: (sender) => {
      const u = Game.variables.회원[sender];
      let msg = "";
      let threshold = Math.floor(u.레벨 ** 4 * 5);
      while (u.경험치 >= threshold) {
        u.경험치 -= threshold;
        u.레벨++;
        const attackIncrease = Math.floor((u.레벨 + 2) ** 2);
        u.공격력 += attackIncrease;
        const newMaxHP = Game.functions.getMaxHP(u);
        const newMaxMP = Game.functions.getMaxMP(u);
        u.체력 = newMaxHP;
        u.MP = newMaxMP;
        msg += `축하합니다! 레벨 ${u.레벨}로 업그레이드되었습니다. (공격력 +${Game.functions.formatNumber(attackIncrease)}, 체력 회복됨: ${Game.functions.formatNumber(newMaxHP)}, MP 회복됨: ${Game.functions.formatNumber(newMaxMP)})\n`;
        threshold = Math.floor((u.레벨 + 1) ** 4 * 5);
      }
      return msg;
    },

    보스확인: (sender, location) => {
      const map = {
        "나무 오두막": "해골 나무늘보",
        "모래 폭풍의 사막": "광기의 낙타",
        "유적의 사막": "도굴꾼",
        "열기의 사막": "피라미드 괴물",
        "바람의 산길": "바람의 괴물",
        "불꽃의 산길": "불꽃의 괴물",
        "대지의 산길": "대지의 괴물",
        "잃어버린 산길": "난폭한 고릴라",
        "진흙 늪": "진흙 거인",
        "연못의 습지": "물먹는 개구리",
        "안개 늪": "역류 개구리",
        "수초의 습지": "화염 악어",
        "상류": "거대 도롱뇽",
        "중류": "저주받은 머맨",
        "하류": "악마 가오리",
        "투명한 바다": "악마 도롱뇽",
        "깊은 바다": "심해 마녀",
        "폭풍의 바다": "폭풍의 군주",
        "어둠의 바다": "어둠의 상어",
        "새벽 하늘": "하늘의 눈동자",
        "맑은 하늘": "마왕의 비둘기",
        "구름 하늘": "저주받은 구름",
        "황혼 하늘": "파괴된 달",
        "수성": "수성의 수호자",
        "금성": "금성의 더위 수호자",
        "화성": "화성의 화염 수호자",
        "목성": "목성의 바람 수호자",
        "토성": "토성의 번개 수호자",
        "천왕성": "천왕성의 저주받은 고리",
        "해왕성": "해왕성의 빙하 수호자",
        "폐허의 세계": "마왕의 부하",
        "마왕의 방": "마왕"
      };
      const bossName = map[location];
      if (bossName && !Game.variables.회원[sender].퀘스트완료[bossName]) {
        return `보스 '${bossName}'의 처치가 완료되지 않았습니다. 반드시 처치 후 이동할 수 있습니다.`;
      }
      return null;
    },

    스토리처리: (sender, commandKey) => {
      const u = Game.variables.회원[sender];
      if (u) {
        if (u.스토리진행중 && commandKey !== "다음") {
          return "현재 스토리가 진행 중입니다. '다음'을 입력하여 스토리를 진행하세요.";
        }
        const locationKey = `${u.위치}_${u.세부위치}`;
        if (!u.세부방문.includes(locationKey) && !u.스토리진행중 && commandKey !== "다음") {
          u.스토리진행중 = true;
          u.스토리인덱스 = 0;
          const locationData = Game.variables.game.지도?.[u.위치]?.[u.세부위치];
          if (locationData?.스토리?.length > 0) return locationData.스토리[u.스토리인덱스];
        }
      }
      return null;
    },

    파라미터입력요청: (currentParams, sender) => {
      const commandKey = Game.currentCommandKey;
      const requiredCount = Game.commands[commandKey].params.length;

      if (commandKey === "회원가입" || commandKey === "로그인") {
        document.querySelectorAll('#buttons button').forEach(btn => btn.style.display = "none");
        const nextParamName = Game.commands[commandKey].params[currentParams.length];
        const helpText =
          "필요한 파라미터: " + Game.commands[commandKey].params.join(", ") +
          "\n현재 입력 완료: " + currentParams.join(" ") +
          "\n다음 파라미터 (" + nextParamName + ")를 입력해주세요:";
        const outputElem = document.getElementById("output");
        Array.from(outputElem.children).forEach(child => child.classList.remove("new"));
        const helpDiv = document.createElement("div");
        helpDiv.classList.add("message", "new");
        helpDiv.textContent = helpText;
        outputElem.prepend(helpDiv);
        const inputDiv = document.createElement("div");
        inputDiv.classList.add("message", "new");
        inputDiv.innerHTML = '<input type="text" id="pendingInput" placeholder="여기에 입력하세요." style="width:100%;padding:5px;font-size:1.2em;">';
        outputElem.prepend(inputDiv);
        const pendingInput = document.getElementById("pendingInput");
        pendingInput.focus();
        pendingInput.addEventListener("keydown", async function(event) {
          if (event.key === "Enter") {
            event.preventDefault();
            const value = pendingInput.value.trim();
            if (value === "취소") {
              pendingInput.disabled = true;
              inputDiv.remove();
              Game.functions.renderMainButtons();
              const cancelMsg = document.createElement("div");
              cancelMsg.classList.add("message", "new");
              cancelMsg.textContent = "명령이 취소되었습니다.";
              outputElem.prepend(cancelMsg);
              return;
            }
            if (value !== "") {
              pendingInput.disabled = true;
              inputDiv.remove();
              const newParams = currentParams.concat(value);
              if (newParams.length < requiredCount) {
                Game.functions.파라미터입력요청(newParams, sender);
              } else {
                Game.functions.updateCommandVisibility(sender);
                const newInput = commandKey + " | " + newParams.join("|");
                const reReply = await Game.reply(newInput, sender);
                if (reReply !== null && reReply.trim() !== "") {
                  const newMsgDiv = document.createElement("div");
                  newMsgDiv.classList.add("message", "new");
                  newMsgDiv.textContent = reReply;
                  outputElem.prepend(newMsgDiv);
                }
              }
            }
          }
        });
      } else {
        let buttonsContainer = document.getElementById("buttons");
        if (!buttonsContainer) {
          buttonsContainer = document.createElement("div");
          buttonsContainer.id = "buttons";
          buttonsContainer.style.display = "block";
          document.body.appendChild(buttonsContainer);
        } else {
          buttonsContainer.innerHTML = "";
        }
        document.querySelectorAll('#buttons button').forEach(btn => btn.style.display = "none");
        const nextParamName = Game.commands[commandKey].params[currentParams.length];
        const helpText =
          "필요한 파라미터: " + Game.commands[commandKey].params.join(", ") +
          "\n현재 입력 완료: " + currentParams.join(" ") +
          "\n다음 파라미터 (" + nextParamName + ")를 선택해주세요:";
        const outputElem = document.getElementById("output");
        Array.from(outputElem.children).forEach(child => child.classList.remove("new"));
        const helpDiv = document.createElement("div");
        helpDiv.classList.add("message", "new");
        helpDiv.textContent = helpText;
        outputElem.prepend(helpDiv);

        let choices = [];
        if (Game.commands[commandKey].getChoices) {
          choices = [...(Game.commands[commandKey].getChoices(sender, currentParams) || [])];
        }
        if (!choices.includes("취소")) choices.push("취소");

        choices.forEach((choice, index) => {
          const button = document.createElement("button");
          button.dataset.temp = "true";
          button.textContent = `${index + 1}: ${choice}`;
          button.addEventListener("click", async () => {
            if (choice === "취소") {
              buttonsContainer.innerHTML = "";
              Game.functions.renderMainButtons();
              const cancelMsg = document.createElement("div");
              cancelMsg.classList.add("message", "new");
              cancelMsg.textContent = "명령이 취소되었습니다.";
              outputElem.prepend(cancelMsg);
            } else {
              const newParams = currentParams.concat(choice);
              buttonsContainer.innerHTML = "";
              if (newParams.length < requiredCount) {
                Game.functions.파라미터입력요청(newParams, sender);
              } else {
                Game.functions.renderMainButtons();
                const newInput = commandKey + " | " + newParams.join("|");
                const reReply = await Game.reply(newInput, sender);
                if (reReply !== null && reReply.trim() !== "") {
                  const newMsgDiv = document.createElement("div");
                  newMsgDiv.classList.add("message", "new");
                  newMsgDiv.textContent = reReply;
                  outputElem.prepend(newMsgDiv);
                }
              }
            }
          });
          buttonsContainer.appendChild(button);
        });
      }
    },

    // 전투 메인 루프
    턴전투진행: async (sender, action) => {
      const user = Game.variables.회원[sender];
      let battle = user?.pendingDecision;
      if (!battle || battle.type !== "턴전투") return "현재 진행 중인 전투가 없습니다.";
      if (!battle.buffs) battle.buffs = { user: {}, monster: {} };

      let output = "";
      let attackMultiplier = 1.0;
      let defendMultiplier = 1.0;
      let skipPlayerAttack = false;

      // ── 전술 처리 (tactics.json 기반)
      if (action && action.startsWith("전술")) {
        const skillName = action.split(" ").slice(1).join(" ").trim();
        if (!skillName) return "사용할 전술명을 입력하세요.";

        const owned = (user.배운전술 || []).find(t => t.이름 === skillName);
        if (!owned) return `보유 전술 중 '${skillName}'을(를) 찾을 수 없습니다.`;

        // 효과 분기: charge / multi / guard_break / evade
        const eff = (owned.효과 || "").toLowerCase();
        if (eff === "charge") {
          battle.buffs.user.charge = true;
          output += "🔶 차지: 다음 공격의 위력이 크게 증가합니다.\n";
          action = "자동공격"; // 후속 처리
          skipPlayerAttack = true;
        } else if (eff === "multi") {
          const times = Math.max(1, Number(owned.타수 || 2));
          const coef = Math.max(0, Number(owned.계수 || 0.7));
          for (let i = 1; i <= times; i++) {
            let dmg = Math.max(0, Math.round(user.공격력 * coef - ((battle.monster.방어력 || 0) * 0.5)));
            if (battle.buffs.user.charge) {
              dmg = Math.round(dmg * 2.0);
              battle.buffs.user.charge = false;
            }
            battle.monster.체력 -= dmg;
            output += `연타 ${i}타 명중! ${Game.functions.formatNumber(dmg)} 피해 (몬스터 체력: ${Game.functions.formatNumber(battle.monster.체력)})\n`;
            if (battle.monster.체력 <= 0) break;
          }
        } else if (eff === "guard_break") {
          const turns = Math.max(1, Number(owned.턴수 || 2));
          battle.buffs.monster.guardBreakTurns = Math.max(turns, (battle.buffs.monster.guardBreakTurns || 0));
          output += "🛠️ 가드브레이크: 몬스터의 방어력이 잠시 약화됩니다.\n";
          action = "자동공격";
          skipPlayerAttack = true;
        } else if (eff === "evade") {
          battle.buffs.user.evade = true;
          output += "🌀 회피: 다음 몬스터의 반격을 회피할 확률이 크게 증가합니다.\n";
          action = "자동공격";
          skipPlayerAttack = true;
        } else {
          // tactics.json 미정의 전술 또는 예비 처리
          return `알 수 없는 전술 효과입니다: ${owned.효과 || "미정의"}`;
        }
      }

      // ── 특수(스킬) 처리
      if (action && action.startsWith("특수")) {
        const parts = action.split(" ");
        if (parts.length < 2) return "사용할 특수 능력을 입력하세요. 예: 특수 | 불꽃 발사";
        const skillName = parts.slice(1).join(" ");
        const owned = (user.배운특수능력 || []).find(s => s.이름 === skillName);
        if (!owned) return `배운 기술 중 ${skillName}이(가) 없습니다.`;
        if (user.MP < owned.MP소모) return `MP가 부족합니다. ${owned.MP소모} MP 소모가 필요합니다.`;

        user.MP -= owned.MP소모;

        if (Math.random() > (owned.명중률 ?? 1)) {
          battle.specialUsed = true;
          const monsterOnly = await Game.functions.턴전투진행(sender, "자동공격");
          return `${sender}님의 "${owned.이름}" 공격이 빗나갔습니다!\n${monsterOnly}`;
        }

        try {
          let fn = null;
          if (typeof owned.능력 === "function") fn = owned.능력;
          else if (typeof owned.능력 === "string") {
            const idx = owned.능력.indexOf("=>");
            fn = idx > -1 ? new Function("monster","user", owned.능력.slice(idx + 2)) : (0, eval)(owned.능력);
          } else if (owned.능력 && typeof owned.능력.능력 !== "undefined") {
            fn = typeof owned.능력.능력 === "function" ? owned.능력.능력 : (0, eval)(owned.능력.능력);
          }
          if (typeof fn === "function") fn(battle.monster, user);
        } catch (e) {
          return `특수 기술 사용 실패: ${e.message}`;
        }

        output += `플레이어가 [특수: ${owned.이름}] 능력을 사용하였습니다.\n`;
        output += `남은 몬스터 체력: ${Game.functions.formatNumber(battle.monster.체력)}\n`;
        battle.initiative = "player";
        user.pendingDecision = battle;
        output += "플레이어의 공격 차례입니다. (사용 가능한 명령어: 공격, 일반, 방어, 전술, 특수)";
        return output;
      }

      // ── 기본 행동 배수
      if (action === "공격") { attackMultiplier = 1.5; defendMultiplier = 1.5; }
      else if (action === "일반") { attackMultiplier = 1.0; defendMultiplier = 1.0; }
      else if (action === "방어") { attackMultiplier = 0.5; defendMultiplier = 0.5; }
      else if (action === "자동공격") { skipPlayerAttack = true; attackMultiplier = 0.0; defendMultiplier = 1.0; }

      let monsterDef = battle.monster.방어력 || 0;
      if ((battle.buffs.monster.guardBreakTurns || 0) > 0) monsterDef = Math.floor(monsterDef * 0.5);

      // ── 플레이어 타격
      if (!skipPlayerAttack && !(action === "일반" && battle.specialUsed)) {
        let baseDmg = Math.round(user.공격력 * attackMultiplier - (monsterDef * 0.5));
        if (battle.buffs.user.charge) {
          baseDmg = Math.round(baseDmg * 2.0);
          battle.buffs.user.charge = false;
        }
        const damage = Math.max(baseDmg, 0);
        battle.monster.체력 -= damage;
        output += `플레이어가 [${action}]으로 ${Game.functions.formatNumber(damage)}의 피해를 주었습니다. (남은 몬스터 체력: ${Game.functions.formatNumber(battle.monster.체력)})\n`;
      } else if (action === "일반" && battle.specialUsed) {
        output += "플레이어의 특수 기술 효과로 추가 일반 공격은 발생하지 않았습니다.\n";
      }

      // ── 플레이어 사망 처리
      if (user.체력 <= 0) {
        output += "플레이어가 패배하였습니다. 게임 오버!\n";
        user.코인 = 0;
        user.위치 = "시작의 마을";
        user.세부위치 = "여관";
        user.pendingDecision = null;
        const maxHP = Game.functions.getMaxHP(user);
        const maxMP = Game.functions.getMaxMP(user);
        user.체력 = maxHP; user.MP = maxMP;
        return output + `당신은 부활하였습니다. 시작의 마을 여관에서 체력이 회복되었습니다. (HP: ${Game.functions.formatNumber(maxHP)}, MP: ${Game.functions.formatNumber(maxMP)})\n`;
      }

      // ── 몬스터 사망 처리 (+ 전술 1% 드롭)
      if (battle.monster.체력 <= 0) {
        if (battle.isBoss) {
          output += `보스 ${battle.monster.이름}을 패배시켰습니다!\n`;
          const expReward = battle.monster.경험치 * 5 || 0;
          const coinReward = expReward * 3;
          user.경험치 += expReward;
          user.코인 += coinReward;
          output += `보상: ${Game.functions.formatNumber(expReward)} 경험치와 ${Game.functions.formatNumber(coinReward)} 코인 지급!\n`;
          user.pendingDecision = null;
          user.보스스토리완료 = false;
          user.보스스토리진행중 = false;
          user.퀘스트완료[battle.monster.이름] = true;

          const learnMsg = await Game.functions.tryLearnTactic(sender);
          if (learnMsg) output += learnMsg;

          return output;
        } else {
          output += `${battle.monster.이름}을 패배시켰습니다!\n`;
          const expReward = battle.monster.경험치 || 0;
          const coinReward = expReward * 3;
          user.경험치 += expReward;
          user.코인 += coinReward;
          battle.monster.체력 = battle.monsterHP;
          user.pendingDecision = null;
          output += `보상: ${Game.functions.formatNumber(expReward)} 경험치와 ${Game.functions.formatNumber(coinReward)} 코인 지급!\n`;

          const learnMsg = await Game.functions.tryLearnTactic(sender);
          if (learnMsg) output += learnMsg;

          return output;
        }
      }

      // ── 몬스터 특수능력 (확률)
      if (!skipPlayerAttack && (battle.monster.MP || 0) > 0 && battle.monster.특수능력) {
        if (Math.random() < 0.3) {
          output += "몬스터가 특수능력을 사용합니다!\n";
          try {
            let abilityFn = battle.monster.특수능력;
            let fn = null;
            if (typeof abilityFn === "function") fn = abilityFn;
            else if (abilityFn && typeof abilityFn.능력 !== "undefined") {
              fn = typeof abilityFn.능력 === "function" ? abilityFn.능력 : (0, eval)(abilityFn.능력);
            }
            if (typeof fn === "function") fn(battle.monster, user);
          } catch (e) {
            console.warn("몬스터 특수능력 실행 오류:", e);
          }
          battle.monster.MP = Math.max(0, (battle.monster.MP || 0) - (battle.monSTER?.특수능력?.MP소모 || 0));
          output += `몬스터 특수능력 사용 후 남은 MP: ${battle.monster.MP}\n`;
          battle.initiative = "player";
          user.pendingDecision = battle;
          const levelUpMsg = Game.functions.레벨업확인(sender);
          if (levelUpMsg) output += levelUpMsg;
          output += "플레이어의 공격 차례입니다. (사용 가능한 명령어: 공격, 일반, 방어, 전술, 특수)";
          return output;
        }
      }

      // ── 몬스터 반격
      const userSpeed = Number(user.속도 || 0);
      const monSpeed = Number(battle.monster.속도 || 0);
      let counterHitChance = (Number(user.명중률) || 0) + (userSpeed * 0.01) - (monSpeed * 0.01);
      if (battle.buffs.user.evade) counterHitChance -= 0.5;
      if (Math.random() > counterHitChance) {
        output += "몬스터의 반격이 빗나갔습니다!\n";
      } else {
        const monsterDamage = Math.max(0, Math.round((battle.monster.공격력 * defendMultiplier) - ((user.방어력 || 0) * 0.5)));
        user.체력 -= monsterDamage;
        output += `몬스터의 반격! ${Game.functions.formatNumber(monsterDamage)}의 피해를 받았습니다. (플레이어 체력: ${Game.functions.formatNumber(user.체력)})\n`;
      }
      if (battle.buffs.user.evade) battle.buffs.user.evade = false;
      if ((battle.buffs.monster.guardBreakTurns || 0) > 0) battle.buffs.monster.guardBreakTurns -= 1;

      // ── 장비 능력 트리거
      const equipmentList = await Game.variables.game.장비;
      for (const equipName of (user.장착장비 || [])) {
        const equippedItem = equipmentList.find(item => item.이름 === equipName);
        if (equippedItem && equippedItem.능력) {
          try {
            if (typeof equippedItem.능력 === "function") {
              equippedItem.능력(battle.monster, user);
              output += `[${equippedItem.이름}] 특수능력 발동!\n`;
            } else if (equippedItem.능력 && typeof equippedItem.능력.능력 !== "undefined") {
              const fn = typeof equippedItem.능력.능력 === "function"
                ? equippedItem.능력.능력
                : (0, eval)(equippedItem.능력.능력);
              if (typeof fn === "function") {
                fn(battle.monster, user);
                output += `[${equippedItem.이름}] 특수능력 발동! ${equippedItem.능력.설명 || ""}\n`;
              }
            }
          } catch (e) {
            console.warn(`[장비 능력] ${equipName} 실행 오류:`, e);
          }
        }
      }

      battle.initiative = "player";
      const levelUpMsg = Game.functions.레벨업확인(sender);
      if (levelUpMsg) output += levelUpMsg;
      user.pendingDecision = battle;
      output += "플레이어의 공격 차례입니다. (사용 가능한 명령어: 공격, 일반, 방어, 전술, 특수)";
      return output;
    },

    // 전술 드롭(1%) 처리
    tryLearnTactic: async (sender) => {
      const u = Game.variables.회원[sender];
      if (!u) return "";
      if (Math.random() >= 0.01) return ""; // 1%

      const all = await Game.variables.game.전술;
      const learnedNames = new Set((u.배운전술 || []).map(t => t.이름));
      const candidates = (all || []).filter(t => !learnedNames.has(t.이름));
      if (candidates.length === 0) return " 모든 전술을 이미 습득했습니다.\n";

      const newTac = candidates[Math.floor(Math.random() * candidates.length)];
      u.배운전술 = u.배운전술 || [];
      u.배운전술.push(newTac);
      return `🎖️ [신규 전술 습득] ${newTac.이름}을(를) 배웠습니다!\n`;
    },

    // 버튼 가시성
    isCommandVisible: async (commandName, sender) => {
      const u = Game.variables.회원[sender];

      // 전투 확인 대기
      if (u?.pendingDecision?.awaitingConfirmation) {
        return ["예","아니오","상태","저장"].includes(commandName);
      }
      // 전투 중
      if (u?.pendingDecision?.type === "턴전투") {
        return ["공격","일반","방어","전술","특수","상태","저장"].includes(commandName);
      }

      switch (commandName) {
        case "회원가입":
        case "로그인":
          return !u;
        case "다음":
          return !!u && u.스토리진행중;
        case "상태":
        case "이동":
        case "탐험":
        case "지도":
        case "저장":
          return !!u;
        case "공격":
        case "일반":
        case "방어":
        case "전술":
        case "특수":
          return !!u && u.pendingDecision && u.pendingDecision.type === "턴전투" && !u.pendingDecision.awaitingConfirmation;
        case "예":
        case "아니오":
          return !!u && u.pendingDecision && u.pendingDecision.awaitingConfirmation;
        case "구매":
          return !!u && u.세부위치 === "무기 상점";
        case "장착":
          return !!u && Array.isArray(u.소유장비) && u.소유장비.length > 0;
        case "숙박":
          return !!u && u.세부위치 === "여관";
        case "보스와 전투":
          return !!u && !u.pendingDecision && u.보스스토리완료 === true && u.보스스토리진행중 === false;
        default:
          return true;
      }
    },

    updateCommandVisibility: async (sender) => {
      if (document.getElementById("pendingInput") || document.querySelector('#buttons button[data-temp="true"]')) return;

      const buttons = document.querySelectorAll('#buttons button');
      const u = Game.variables.회원[sender];

      if (!!u && u.스토리진행중) {
        buttons.forEach(button => {
          button.style.display = (button.dataset.command === "다음") ? 'inline-block' : 'none';
        });
      } else {
        for (const button of buttons) {
          const cmd = button.dataset.command;
          const isVisible = await Game.functions.isCommandVisible(cmd, sender);
          button.style.display = isVisible ? 'inline-block' : 'none';
        }
      }

      const visibleButtons = Array.from(document.querySelectorAll('#buttons button')).filter(button => button.style.display !== 'none');
      const extraKeys = "qwertyuiopasdfghjklzxcvbnm";
      visibleButtons.forEach((button, index) => {
        let shortcut;
        if (index < 10) {
          shortcut = (index === 9) ? "0" : String(index + 1);
        } else {
          shortcut = extraKeys[index - 10] || "";
        }
        let shortcutSpan = button.querySelector('.shortcut-key');
        if (!shortcutSpan) {
          shortcutSpan = document.createElement('span');
          shortcutSpan.classList.add('shortcut-key');
          button.appendChild(shortcutSpan);
        }
        shortcutSpan.textContent = shortcut;
      });
    },

    renderMainButtons: () => {
      const buttonGroup = document.getElementById('buttons');
      buttonGroup.innerHTML = "";
      for (let command in Game.commands) {
        const button = document.createElement('button');
        button.textContent = command;
        button.dataset.command = command;
        button.addEventListener('click', async () => {
          const reply = await Game.reply(command, currentSender);
          if (reply) {
            const outputElem = document.getElementById("output");
            Array.from(outputElem.children).forEach(child => child.classList.remove("new"));
            const msgDiv = document.createElement("div");
            msgDiv.classList.add("message", "new");
            msgDiv.textContent = reply;
            outputElem.prepend(msgDiv);
          }
          Game.functions.updateCommandVisibility(currentSender);
        });
        buttonGroup.appendChild(button);
      }
    },

    getMaxHP: (user) => {
      let maxHP = 120;
      for (let i = 1; i <= user.레벨 - 1; i++) maxHP += Math.floor((i + 2) ** 2 * 10);
      return maxHP;
    },
    getMaxMP: (user) => {
      let maxMP = 50;
      for (let i = 1; i <= user.레벨 - 1; i++) maxMP += Math.floor((i + 2) * 20);
      return maxMP;
    },
    formatNumber: (num) => {
      if (num < 10000) return num.toString();
      const units = ["만","억","조","경","해","자","양","구","간","정","재","극"];
      let unitIndex = Math.floor((Math.log10(num) - 4) / 4);
      if (unitIndex < 0) unitIndex = 0;
      if (unitIndex >= units.length) unitIndex = units.length - 1;
      const divisor = Math.pow(10000, unitIndex + 1);
      const value = num / divisor;
      let formatted = unitIndex === 0
        ? Math.floor(value).toString()
        : (Math.floor(value * 10) / 10).toString().replace(/\.0$/, "");
      const remainder = num % divisor;
      return (remainder === 0 ? formatted : "약 " + formatted) + units[unitIndex];
    },

    _saveUser: async (userObj) => {
      // 🔹 서버 저장: 기본 데이터는 DB에 반영
      try {
        const payload = { ...userObj };
        delete payload.isNewRegistration; // 가입 플래그는 서버 저장시 제외

        const res = await fetch("/api/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.warn("서버 저장 실패:", err.message || res.statusText);
        }
      } catch (e) {
        console.warn("서버 저장 중 오류:", e);
      }

      // 🔹 로컬 캐시: 비밀번호 제외, 게임 상태만
      try {
        const cache = { ...userObj };
        delete cache.password;
        localStorage.setItem(`rpg_user_${userObj.username}`, JSON.stringify(cache));
      } catch (e) {
        console.warn("로컬 저장 실패:", e);
      }
    },

    _loadUser: (username) => {
      // 🔹 서버 로그인은 /api/login 으로 따로 수행
      //    로컬 캐시는 단순 편의용 복구
      try {
        const raw = localStorage.getItem(`rpg_user_${username}`);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        delete parsed.password; // 혹시 남아있으면 제거
        return parsed;
      } catch (e) {
        console.warn("로컬 로드 실패:", e);
        return null;
      }
    }
  },

  // ───────────────── 입력 처리 ─────────────────
  reply: async (input, sender) => {
    const tokens = input.split("|").map(token => token.trim());
    const commandKey = tokens[0];
    const paramsFromInput = tokens.slice(1);
    if (!Game.commands[commandKey]) return null;

    if ((commandKey !== "회원가입" && commandKey !== "로그인") && !Game.functions.회원확인(sender)) {
      return `${sender}님, 먼저 회원가입을 진행해주세요.`;
    }

    const u = Game.variables.회원[sender];
    if (u && u.pendingDecision && commandKey !== "저장") {
      if (u.pendingDecision.type === "턴전투") {
        if (u.pendingDecision.awaitingConfirmation) {
          if (!["공격","방어","일반","전술","특수","상태","예","아니오","저장"].includes(commandKey)) {
            return "전투 중에는 공격, 방어, 일반, 전술, 특수, 상태(확인 대기 중에는 예/아니오)만 사용 가능합니다.";
          }
        } else {
          if (!["공격","방어","일반","전술","특수","상태","예","아니오","저장"].includes(commandKey)) {
            return "전투 중에는 공격, 방어, 일반, 전술, 특수, 상태만 사용 가능합니다.";
          }
        }
      }
    }

    const storyCheck = Game.functions.스토리처리(sender, commandKey);
    if (storyCheck !== null) return storyCheck;

    if (Game.commands[commandKey].params.length > 0) {
      if (paramsFromInput.length < Game.commands[commandKey].params.length) {
        Game.currentCommandKey = commandKey;
        Game.functions.파라미터입력요청(paramsFromInput, sender);
        return "";
      } else {
        return Game.commands[commandKey].출력(sender, paramsFromInput);
      }
    } else {
      return Game.commands[commandKey].출력(sender);
    }
  }
};

// ───────────────── 데이터 로딩 & 캐시 ─────────────────
Game.variables.game = {
  "지도": fetch("./game/map.json")
    .then(response => response.json())
    .then(data => { Game.mapCache = data; return data; })
    .catch(error => { console.error("지도 데이터 로드 실패", error); return {}; }),

  "몬스터": fetch("./game/monster.json")
    .then(response => response.json())
    .then(data => { Game.monsterCache = data; return data; })
    .catch(error => { console.error("몬스터 데이터 로드 실패", error); return {}; }),

  "장비": fetch("./game/equipment.json")
    .then(response => response.json())
    .then(data => { Game.equipmentCache = data; return data; })
    .catch(error => { console.error("장비 데이터 로드 실패", error); return []; }),

  "기술": fetch("./game/skill.json")
    .then(response => response.json())
    .then(data => { Game.skillCache = data; return data; })
    .catch(error => { console.error("기술 데이터 로드 실패", error); return []; }),

  // ★ tactics.json 추가 (전술 목록)
  "전술": fetch("./game/tactics.json")
    .then(response => response.json())
    .then(data => {
      // 파일이 없거나 형식이 다르면 기본 전술 세트로 폴백
      const valid = Array.isArray(data) && data.every(t => typeof t.이름 === "string");
      const fallback = [
        { 이름: "차지", 설명: "다음 공격 대미지 2배", 효과: "charge" },
        { 이름: "연타", 설명: "0.7배 대미지로 2회 공격", 효과: "multi", 타수: 2, 계수: 0.7 },
        { 이름: "가드브레이크", 설명: "몬스터 방어력 일시 약화", 효과: "guard_break", 턴수: 2 },
        { 이름: "회피", 설명: "다음 반격 회피 확률↑", 효과: "evade" }
      ];
      Game.tacticsCache = valid ? data : fallback;
      return Game.tacticsCache;
    })
    .catch(error => {
      console.error("전술 데이터 로드 실패(tactics.json 없음?) — 기본 전술 사용", error);
      const fallback = [
        { 이름: "차지", 설명: "다음 공격 대미지 2배", 효과: "charge" },
        { 이름: "연타", 설명: "0.7배 대미지로 2회 공격", 효과: "multi", 타수: 2, 계수: 0.7 },
        { 이름: "가드브레이크", 설명: "몬스터 방어력 일시 약화", 효과: "guard_break", 턴수: 2 },
        { 이름: "회피", 설명: "다음 반격 회피 확률↑", 효과: "evade" }
      ];
      Game.tacticsCache = fallback;
      return fallback;
    })
};

// ───────────────── UI/입력 바인딩 ─────────────────
Game.functions.renderMainButtons();

// 숫자 단축키
document.addEventListener("keydown", (event) => {
  if (document.activeElement && (document.activeElement.tagName.toLowerCase() === "input" || document.activeElement.tagName.toLowerCase() === "textarea")) {
    return;
  }
  const validKeys = ["1","2","3","4","5","6","7","8","9","0"];
  if (validKeys.includes(event.key)) {
    event.preventDefault();
    event.stopPropagation();
    const visibleButtons = Array.from(document.querySelectorAll('#buttons button')).filter(button => button.style.display !== 'none');
    const index = event.key === "0" ? 9 : (parseInt(event.key, 10) - 1);
    if (index < visibleButtons.length) visibleButtons[index].click();
  }
});

// 버튼 가시성 주기 갱신
setInterval(() => Game.functions.updateCommandVisibility(currentSender), 100);