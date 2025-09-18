// main.js (전체 수정본)
let currentSender = null;

const Game = {
  variables: {
    회원: {},
    game: {},
  },
  commands: {
    "회원가입": {
      params: ["username", "password"],
      출력: async (sender, params) => {
        if (params.length < 2) {
          return "사용자 이름과 비밀번호를 입력하세요. 예: 회원가입 [이름] [비밀번호]";
        }

        const username = params[0];
        const password = params[1];
        if (Game.variables.회원[username]) {
          return `${username}님은 이미 회원가입이 완료되었습니다.`;
        }

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
          "명중률": 0.8,
          퀘스트완료: {},
          보스스토리완료: false,
          배운특수능력: []
        };

        try {
          const response = await fetch("/api/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(memberData)
          });

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            return `회원가입 실패: ${data.message || "서버 오류 발생"}`;
          }

          const data = await response.json().catch(() => ({}));
          if (data.success) {
            currentSender = username;
            // 온라인 등록
            try {
              await fetch('/api/online/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
              });
            } catch (e) {}
          } else {
            return `회원가입 실패: ${data.message || "알 수 없는 오류"}`;
          }
        } catch (error) {
          console.error("API Error:", error);
          return "회원 데이터 저장 중 오류가 발생했습니다.";
        }

        if (Game.variables.회원[username]) {
          return `${username}님, 해당 닉네임은 이미 존재합니다.`;
        }

        const mapData = await Game.variables.game.지도;
        const storyArr = mapData?.["시작의 마을"]?.["마을 입구"]?.스토리;
        Game.variables.회원[username] = memberData;
        const outputMsg = (Array.isArray(storyArr) && storyArr.length > 0)
          ? storyArr[0]
          : `${username}님, 회원가입이 완료되었습니다!`;

        return outputMsg;
      }
    },
    "로그인": {
      params: ["username", "password"],
      출력: async (sender, params) => {
        const username = params[0];
        const password = params[1];
        try {
          const response = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return `로그인 실패: ${errorData.message || "서버 오류 발생"}`;
          }

          const data = await response.json().catch(() => ({}));
          if (!data.success) {
            return `로그인 실패: ${data.message || "서버 오류 발생"}`;
          }

          Game.variables.회원[username] = data.data;
          currentSender = username;
          // 온라인 등록
          try {
            await fetch('/api/online/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username })
            });
          } catch (e) {}

          return `${username}님, 로그인 성공!`;
        } catch (error) {
          console.error("Login error:", error);
          return "로그인 처리 중 오류가 발생했습니다.";
        }
      }
    },
    "상태": {
      params: [],
      출력: (sender, params) => {
        let status = `${sender}님의 상태\n`;
        status += `잔액: ${Game.functions.formatNumber(Game.variables.회원[sender].코인)}\n`;
        status += `체력: ${Game.functions.formatNumber(Game.variables.회원[sender].체력)}\n`;
        status += `MP: ${Game.functions.formatNumber(Game.variables.회원[sender].MP)}\n`;
        status += `공격력: ${Game.functions.formatNumber(Game.variables.회원[sender].공격력)}\n`;
        status += `경험치: ${Game.functions.formatNumber(Game.variables.회원[sender].경험치)}\n`;
        status += `레벨: ${Game.variables.회원[sender].레벨}\n`;
        status += `소유 장비: ${Game.variables.회원[sender].소유장비.length ? Game.variables.회원[sender].소유장비.join(', ') : '없음'}\n`;
        status += `장착 장비: ${Game.variables.회원[sender].장착장비.length ? Game.variables.회원[sender].장착장비.join(', ') : '없음'}\n`;
        status += `현재 위치: ${Game.variables.회원[sender].위치} / ${Game.variables.회원[sender].세부위치}\n`;
        status += `퀘스트 완료: ${Object.keys(Game.variables.회원[sender].퀘스트완료).length ? Object.keys(Game.variables.회원[sender].퀘스트완료).join(', ') : '없음'}\n`;
        status += `보유 기술: ${Game.variables.회원[sender].배운특수능력 && Game.variables.회원[sender].배운특수능력.length > 0 ? Game.variables.회원[sender].배운특수능력.map(skill => skill.이름).join(', ') : '없음'}`;
        return status;
      }
    },
    "다음": {
      params: [],
      출력: async (sender, params) => {
        const mapData = await Game.variables.game.지도;
        const locData = mapData?.[Game.variables.회원[sender].위치]?.[Game.variables.회원[sender].세부위치];
        if (!locData || !Array.isArray(locData.스토리)) {
          Game.variables.회원[sender].스토리진행중 = false;
          return "진행할 스토리가 없습니다.";
        }
        const storyArr = locData.스토리;
        Game.variables.회원[sender].스토리인덱스++;
        if (Game.variables.회원[sender].스토리인덱스 < storyArr.length) {
          return storyArr[Game.variables.회원[sender].스토리인덱스];
        } else {
          Game.variables.회원[sender].스토리진행중 = false;
          const locationKey = `${Game.variables.회원[sender].위치}_${Game.variables.회원[sender].세부위치}`;
          if (!Game.variables.회원[sender].세부방문.includes(locationKey)) {
            Game.variables.회원[sender].세부방문.push(locationKey);
          }
          let finishMessage = "스토리 완료.";
          if (Game.variables.회원[sender].위치 === "시작의 마을" && Game.variables.회원[sender].세부위치 === "무기 상점") {
            if (!Game.variables.회원[sender].소유장비.includes("마을의 검")) {
              Game.variables.회원[sender].소유장비.push("마을의 검");
              finishMessage += " 무기 대장장이가 '마을의 검'을 지급하였습니다.";
            }
          }
          const bossRooms = ["나무 오두막", "마왕의 방", "모래 폭풍의 사막", "유적의 사막", "열기의 사막", "잃어버린 사막", "바람의 산길", "얼음 산길", "불꽃 산길", "잃어버린 산길", "진흙 늪", "연못의 습지", "안개 늪", "수초의 습지", "상류", "중류", "하류", "투명한 바다", "깊은 바다", "폭풍의 바다", "어둠의 바다", "새벽 하늘", "구름 하늘", "수성", "금성", "화성", "목성", "토성", "천왕성", "해왕성", "폐허의 세계"];
          if (bossRooms.includes(Game.variables.회원[sender].세부위치)) {
            Game.variables.회원[sender].보스스토리완료 = true;
            finishMessage += " 보스 스토리가 완료되었습니다.";
          }
          return finishMessage;
        }
      }
    },
    "이동": {
      params: ["세부위치"],
      getChoices: (sender, currentParams) => {
        let choices = [];
        const mapData = Game.mapCache || {};
        const currentLocation = mapData?.[Game.variables.회원[sender].위치]?.[Game.variables.회원[sender].세부위치];
        if (currentLocation && Array.isArray(currentLocation.연결)) {
          currentLocation.연결.forEach(conn => {
            if (typeof conn === "string") choices.push(conn);
            else if (typeof conn === "object") choices.push(conn.sub);
          });
        }
        return choices;
      },
      출력: async (sender, params) => {
        const mapData = await Game.variables.game.지도;
        const currentLocation = mapData?.[Game.variables.회원[sender].위치]?.[Game.variables.회원[sender].세부위치];
        if (!currentLocation) {
          return `현재 위치 (${Game.variables.회원[sender].위치}, ${Game.variables.회원[sender].세부위치})의 지도 데이터가 없습니다.`;
        }
        let bossCheckMsg = Game.functions.보스확인(sender, Game.variables.회원[sender].세부위치);
        if (bossCheckMsg) { return bossCheckMsg; }
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
            if (conn === destination) { allowed = { main: Game.variables.회원[sender].위치, sub: destination }; break; }
          } else if (typeof conn === "object") {
            if (conn.sub === destination) { allowed = conn; break; }
          }
        }
        if (!allowed) return `현재 위치에서 "${destination}"(으)로 이동할 수 없습니다.`;
        Game.variables.회원[sender].위치 = allowed.main;
        Game.variables.회원[sender].세부위치 = allowed.sub;
        if (!Game.variables.회원[sender].방문.includes(allowed.main)) { Game.variables.회원[sender].방문.push(allowed.main); }
        const locationKey = `${Game.variables.회원[sender].위치}_${Game.variables.회원[sender].세부위치}`;
        if (!Game.variables.회원[sender].세부방문.includes(locationKey)) {
          Game.variables.회원[sender].세부방문.push(locationKey);
          Game.variables.회원[sender].스토리진행중 = true;
          Game.variables.회원[sender].스토리인덱스 = 0;
          const locationData = mapData?.[Game.variables.회원[sender].위치]?.[Game.variables.회원[sender].세부위치];
          if (locationData?.스토리?.length > 0) {
            return locationData.스토리[Game.variables.회원[sender].스토리인덱스];
          } else {
            return `"${allowed.sub}"(으)로 이동하였습니다. (스토리 데이터 없음)`;
          }
        }
        return `"${allowed.sub}"(으)로 이동하였습니다."`;
      }
    },
    "탐험": {
      params: [],
      출력: async (sender, params) => {
        if (!Game.variables.회원[sender]) return `${sender}님, 먼저 회원가입을 진행해주세요.`;

        if (Game.variables.회원[sender].pendingDecision && Game.variables.회원[sender].pendingDecision.type === "탐험전투") {
          if (params.length > 0) {
            const answer = params[0].trim().toLowerCase();
            if (answer === "예" || answer === "yes") {
              const battle = {
                type: "턴전투",
                monster: Game.variables.회원[sender].pendingDecision.monster,
                monsterHP: Game.variables.회원[sender].pendingDecision.monsterHP,
                initiative: "player",
                specialUsed: false,
                confirmedWithNormal: true,
                buffs: { user: {}, monster: {} }
              };
              Game.variables.회원[sender].pendingDecision = battle;
              return `${battle.monster.이름}과의 전투를 시작합니다! 플레이어가 선공입니다. 전투 진행은 "공격", "일반", "방어", "전술", "특수" 명령어를 사용하세요.`;
            } else if (answer === "아니오" || answer === "no") {
              Game.variables.회원[sender].pendingDecision = null;
              return "전투를 취소하고 탐험을 계속합니다.";
            } else {
              return "올바른 입력이 아닙니다. '예' 또는 '아니오'를 입력해주세요.";
            }
          } else {
            return `${Game.variables.회원[sender].pendingDecision.monster.이름}을(를) 발견하였습니다. 전투를 시작하시겠습니까? (예/아니오)`;
          }
        }

        const chance = Math.random();

        if (chance < 0.10) {
          if (Game.variables.회원[sender].위치 === "마왕의 성") {
            const mapData = await Game.variables.game.지도;
            const currentFloor = Game.variables.회원[sender].세부위치;
            const connections = mapData?.["마왕의 성"]?.[currentFloor]?.연결;
            let nextFloor = null;
            if (Array.isArray(connections)) {
              for (let conn of connections) {
                if (conn?.main === "마왕의 성" && conn?.sub) { nextFloor = conn.sub; break; }
              }
            }
            if (nextFloor) {
              Game.variables.회원[sender].세부위치 = nextFloor;
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
          const monsters = monstersData?.[Game.variables.회원[sender].위치]?.[Game.variables.회원[sender].세부위치] || [];
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
          Game.variables.회원[sender].pendingDecision = battle;
          return Game.functions.턴전투진행(sender, "일반");
        }

        const monstersData = await Game.variables.game.몬스터;
        const monsters = monstersData?.[Game.variables.회원[sender].위치]?.[Game.variables.회원[sender].세부위치] || [];
        if (monsters.length === 0) return "주변에 적이 없어 탐험을 계속합니다.";
        const monster = monsters[Math.floor(Math.random() * monsters.length)];
        Game.variables.회원[sender].pendingDecision = {
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
    "지도": {
      params: [],
      출력: async (sender, params) => {
        const mapData = await Game.variables.game.지도;
        const currentLocation = mapData?.[Game.variables.회원[sender].위치]?.[Game.variables.회원[sender].세부위치];
        if (!currentLocation) {
          return `현재 위치 (${Game.variables.회원[sender].위치}, ${Game.variables.회원[sender].세부위치})의 지도 데이터가 없습니다.`;
        }
        if (!Array.isArray(currentLocation.연결) || currentLocation.연결.length === 0) {
          return `현재 ${Game.variables.회원[sender].위치}에서 이동할 수 있는 장소가 없습니다.`;
        }
        const moves = currentLocation.연결.map(conn => (typeof conn === "string" ? conn : `(${conn.main}) ${conn.sub}`));
        return `현재 ${Game.variables.회원[sender].위치}에서 이동 가능한 장소: ${moves.join(", ")}`;
      }
    },
    "공격": {
      params: [],
      출력: (sender, params) => {
        if (Game.variables.회원[sender].pendingDecision && Game.variables.회원[sender].pendingDecision.type === "턴전투") {
          return Game.functions.턴전투진행(sender, "공격");
        }
        return "현재 진행 중인 전투가 없습니다.";
      }
    },
    "일반": {
      params: [],
      출력: (sender, params) => {
        if (Game.variables.회원[sender].pendingDecision && Game.variables.회원[sender].pendingDecision.type === "턴전투") {
          return Game.functions.턴전투진행(sender, "일반");
        }
        return "현재 진행 중인 전투가 없습니다.";
      }
    },
    "방어": {
      params: [],
      출력: (sender, params) => {
        if (Game.variables.회원[sender].pendingDecision && Game.variables.회원[sender].pendingDecision.type === "턴전투") {
          return Game.functions.턴전투진행(sender, "방어");
        }
        return "현재 진행 중인 전투가 없습니다.";
      }
    },
    // ★ 전술 추가 (전투 다양화)
    "전술": {
      params: ["전술명"],
      getChoices: (sender, currentParams) => ["차지", "연타", "가드브레이크", "회피"],
      출력: (sender, params) => {
        if (!(Game.variables.회원[sender]?.pendingDecision?.type === "턴전투")) {
          return "전투 중에만 사용할 수 있습니다.";
        }
        const skill = (params[0] || "").trim();
        if (!["차지","연타","가드브레이크","회피"].includes(skill)) {
          return "전술은 차지/연타/가드브레이크/회피 중에서 선택하세요.";
        }
        return Game.functions.턴전투진행(sender, `전술 ${skill}`);
      }
    },
    "구매": {
      params: ["장비이름"],
      getChoices: (sender, currentParams) => {
        const equipments = Game.equipmentCache || [];
        if (Game.variables.회원[sender].세부위치 === "무기 상점") {
          return equipments.filter(eq => eq.판매마을 === Game.variables.회원[sender].위치).map(eq => eq.이름);
        }
      },
      출력: async (sender, params) => {
        const availableEquipments = await Game.variables.game.장비;

        if (!params[0]) {
          let equipmentList;
          if (Game.variables.회원[sender].세부위치 === "무기 상점") {
            equipmentList = availableEquipments.filter(eq => eq.판매마을 === Game.variables.회원[sender].위치);
          } else {
            equipmentList = [];
          }
          if (equipmentList.length === 0) {
            return `현재 ${Game.variables.회원[sender].위치}에서는 구매 가능한 장비가 없습니다.`;
          }
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
        if (Game.variables.회원[sender].세부위치 === "무기 상점") {
          equipment = availableEquipments.find(eq => eq.이름 === equipmentName && eq.판매마을 === Game.variables.회원[sender].위치);
        }

        if (!equipment) return `장비 상점에 ${equipmentName}은(는) 존재하지 않습니다.`;
        if (Game.variables.회원[sender].코인 < equipment.cost) {
          return `잔액이 부족합니다. ${Game.functions.formatNumber(equipment.cost)} 코인이 필요합니다.`;
        }

        let detailMsg = `선택한 장비: ${equipment.이름}\n가격: ${Game.functions.formatNumber(equipment.cost)} 코인`;
        if (equipment.설명) detailMsg += `\n설명: ${equipment.설명}`;
        if (equipment.특수능력) detailMsg += `\n특수능력: ${equipment.특수능력.이름}`;
        detailMsg += `\n구매하시려면 '예' 명령어를 입력하고, 취소하시려면 '아니오' 명령어를 입력하세요.`;

        Game.variables.회원[sender].pendingDecision = {
          type: "장비구매",
          equipment,
          awaitingConfirmation: true
        };
        return detailMsg;
      }
    },
    "장착": {
      params: ["장비이름"],
      getChoices: (sender, currentParams) => {
        return Game.variables.회원[sender].소유장비;
      },
      출력: async (sender, params) => {
        const equipmentName = params[0];
        if (!Game.variables.회원[sender].소유장비.includes(equipmentName)) {
          return `${equipmentName}을(를) 소유하고 있지 않습니다.`;
        }
        if (Game.variables.회원[sender].장착장비.length > 0 && Game.variables.회원[sender].장착장비[0] === equipmentName) {
          return `${equipmentName}은(는) 이미 장착되어 있습니다.`;
        }
        if (Game.variables.회원[sender].장착장비.length > 0 && Game.variables.회원[sender].장착장비[0] !== equipmentName) {
          Game.variables.회원[sender].장착장비 = [];
        }
        const equipmentList = await Game.variables.game.장비;
        const equipment = equipmentList.find(eq => eq.이름 === equipmentName);
        if (!equipment) {
          return `${equipmentName}을(를) 찾을 수 없습니다.`;
        }

        if (equipment.능력) {
          let abilityFn;
          if (typeof equipment.능력 === 'object' && equipment.능력.능력) {
            if (typeof equipment.능력.능력 === 'string') {
              abilityFn = eval(equipment.능력.능력);
              equipment.능력.능력 = abilityFn;
            } else {
              abilityFn = equipment.능력.능력;
            }
          } else if (typeof equipment.능력 === 'string') {
            abilityFn = eval(equipment.능력);
            equipment.능력 = abilityFn;
          }
        }

        Game.variables.회원[sender].장착장비.push(equipmentName);
        return `${equipmentName}이(가) 장착되었습니다.`;
      }
    },
    "숙박": {
      params: [],
      출력: (sender, params) => {
        if (Game.variables.회원[sender].세부위치 === "여관") {
          const cost = 20;
          if (Game.variables.회원[sender].코인 >= cost) {
            Game.variables.회원[sender].코인 -= cost;
            const maxHP = Game.functions.getMaxHP(Game.variables.회원[sender]);
            const maxMP = Game.functions.getMaxMP(Game.variables.회원[sender]);
            Game.variables.회원[sender].체력 = maxHP;
            Game.variables.회원[sender].MP = maxMP;
            return `숙박료 ${Game.functions.formatNumber(cost)} 코인을 지불하였습니다. 체력과 MP가 완전히 회복되었습니다. (HP: ${Game.functions.formatNumber(maxHP)}, MP: ${Game.functions.formatNumber(maxMP)})`;
          } else {
            return `숙박에는 ${Game.functions.formatNumber(cost)} 코인이 필요합니다. 현재 코인: ${Game.functions.formatNumber(Game.variables.회원[sender].코인)}`;
          }
        } else {
          return "현재 위치에는 여관이 없습니다.";
        }
      }
    },
    "예": {
      params: [],
      출력: (sender, params) => {
        const pend = Game.variables.회원[sender]?.pendingDecision;
        if (!pend) return "현재 결정할 사항이 없습니다.";

        if (pend.type === "턴전투") {
          if (pend.awaitingConfirmation) {
            pend.awaitingConfirmation = false;
            return Game.functions.턴전투진행(sender, "일반");
          }
          return Game.functions.턴전투진행(sender, "일반");
        } else if (pend.type === "특수구매") {
          const skill = pend.skill;
          if (Game.variables.회원[sender].코인 < skill.cost) {
            Game.variables.회원[sender].pendingDecision = null;
            return `잔액이 부족합니다. ${Game.functions.formatNumber(skill.cost)} 코인이 필요합니다. 현재 코인: ${Game.functions.formatNumber(Game.variables.회원[sender].코인)}`;
          }
          if (!Array.isArray(Game.variables.회원[sender].배운특수능력)) {
            Game.variables.회원[sender].배운특수능력 = [];
          }
          if (Game.variables.회원[sender].배운특수능력.some(s => s.이름 === skill.이름)) {
            Game.variables.회원[sender].pendingDecision = null;
            return `${skill.이름}는 이미 배운 기술입니다.`;
          }
          // ✅ 여기서만 차감
          Game.variables.회원[sender].코인 -= skill.cost;
          Game.variables.회원[sender].배운특수능력.push(skill);
          Game.variables.회원[sender].pendingDecision = null;
          return `${skill.이름} 구매 완료! 남은 코인: ${Game.functions.formatNumber(Game.variables.회원[sender].코인)}`;
        } else if (pend.type === "장비구매") {
          const equipment = pend.equipment;
          if (Game.variables.회원[sender].코인 < equipment.cost) {
            Game.variables.회원[sender].pendingDecision = null;
            return `잔액이 부족합니다. ${Game.functions.formatNumber(equipment.cost)} 코인이 필요합니다. 현재 코인: ${Game.functions.formatNumber(Game.variables.회원[sender].코인)}`;
          }
          // ✅ 여기서만 차감
          Game.variables.회원[sender].코인 -= equipment.cost;
          Game.variables.회원[sender].소유장비.push(equipment.이름);
          Game.variables.회원[sender].pendingDecision = null;
          return `${equipment.이름} 구매 완료! 남은 코인: ${Game.functions.formatNumber(Game.variables.회원[sender].코인)}`;
        } else {
          return "현재 결정할 사항이 없습니다.";
        }
      }
    },
    "아니오": {
      params: [],
      출력: (sender, params) => {
        const pend = Game.variables.회원[sender]?.pendingDecision;
        if (!pend) return "현재 결정할 사항이 없습니다.";
        // ✅ 취소 시 코인 차감 절대 금지: 아무 변화 없이 펜딩만 제거
        if (pend.type === "턴전투") {
          Game.variables.회원[sender].pendingDecision = null;
          return "전투를 취소하고 탐험을 계속합니다.";
        } else if (pend.type === "특수구매") {
          Game.variables.회원[sender].pendingDecision = null;
          return "구매가 취소되었습니다. 다른 기술을 선택해주세요.";
        } else if (pend.type === "장비구매") {
          Game.variables.회원[sender].pendingDecision = null;
          return "장비 구매가 취소되었습니다.";
        } else {
          Game.variables.회원[sender].pendingDecision = null;
          return "취소되었습니다.";
        }
      }
    },
    "보스와 전투": {
      params: [],
      출력: async (sender, params) => {
        const mapData = await Game.variables.game.지도;
        const locationData = mapData?.[Game.variables.회원[sender].위치]?.[Game.variables.회원[sender].세부위치];
        if (!locationData || !locationData.보스) return "현재 위치에서는 보스 전투를 진행할 수 없습니다.";

        const bossName = locationData.보스;
        const bossResponse = await fetch("./game/boss.json");
        const bossDatabase = await bossResponse.json();
        const bossData = bossDatabase[bossName];
        if (!bossData) return "현재 위치의 보스 정보가 누락되었습니다.";

        let bossStory = "";
        if (locationData.스토리 && Array.isArray(locationData.스토리)) {
          bossStory = locationData.스토리.join("\n") + "\n";
        }

        const boss = { 이름: bossName, ...bossData, 스토리: bossStory };

        Game.variables.회원[sender].pendingDecision = {
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
    "저장": {
      params: [],
      출력: async (sender, params) => {
        if (!Game.variables.회원[sender]) return "로그인 상태가 아닙니다.";
        const userToSave = { ...Game.variables.회원[sender] };
        delete userToSave.isNewRegistration;
        try {
          const response = await fetch("/api/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userToSave)
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return `저장 실패: ${errorData.message || "서버 오류 발생"}`;
          }

          const data = await response.json().catch(() => ({}));
          if (!data.success) {
            return `저장 실패: ${data.message || "서버 오류 발생"}`;
          }

          return "게임 데이터가 정상적으로 저장되었습니다.";
        } catch (error) {
          console.error("Save error:", error);
          return "저장 처리 중 오류가 발생했습니다.";
        }
      }
    },
    "특수구매": {
      params: ["기술이름"],
      getChoices: (sender, currentParams) => {
        const skills = Game.skillCache || [];
        if (currentParams.length === 0 && Game.variables.회원[sender].세부위치 === "기술 상점") {
          return skills.filter(skill => skill.판매마을 === Game.variables.회원[sender].위치).map(skill => skill.이름);
        }
      },
      출력: async (sender, params) => {
        const skillList = await Game.variables.game.기술;
        if (!params[0]) {
          let availableSkills = [];
          if (Game.variables.회원[sender].세부위치 === "기술 상점") {
            availableSkills = skillList.filter(skill => skill.판매마을 === Game.variables.회원[sender].위치);
          }
          if (availableSkills.length === 0) return `현재 ${Game.variables.회원[sender].위치}에서는 구매 가능한 기술이 없습니다.`;
          let listStr = "구매 가능한 기술 목록:\n";
          availableSkills.forEach(skill => {
            listStr += `${skill.이름} - 가격: ${Game.functions.formatNumber(skill.cost)} 코인`;
            if (skill.MP소모 !== undefined) listStr += ` (MP소모: ${skill.MP소모})`;
            listStr += `, 판매마을: ${skill.판매마을}\n`;
          });
          return listStr;
        }

        const skillName = params[0];
        let skill = null;
        if (Game.variables.회원[sender].세부위치 === "기술 상점") {
          skill = skillList.find(s => s.이름 === skillName && s.판매마을 === Game.variables.회원[sender].위치);
        }
        if (!skill) return `현재 ${Game.variables.회원[sender].위치}의 기술 상점에는 "${skillName}" 기술이 존재하지 않습니다.`;

        Game.variables.회원[sender].pendingDecision = { type: "특수구매", skill, awaitingConfirmation: true };
        let detailMsg = `선택한 기술: ${skill.이름}\n가격: ${Game.functions.formatNumber(skill.cost)} 코인\n설명: ${skill.설명}\nMP소모: ${skill.MP소모}\n명중률: ${skill.명중률}\n구매하시려면 '예' 명령어를, 취소하시려면 '아니오' 명령어를 입력하세요.`;
        return detailMsg;
      }
    },
    "특수": {
      params: ["스킬명"],
      출력: async (sender, params) => {
        const pend = Game.variables.회원[sender]?.pendingDecision;
        if (!pend || pend.type !== "턴전투" || !pend.monster?.이름) {
          return "현재 전투 상황이 아닙니다. 특수 능력은 전투 중에만 사용할 수 있습니다.";
        }
        if (!Game.variables.회원[sender].배운특수능력 || Game.variables.회원[sender].배운특수능력.length === 0) {
          return "당신은 아직 어떠한 특수 능력도 배우지 않았습니다.";
        }
        if (!params[0]) {
          return "보유한 특수 능력 목록: " + Game.variables.회원[sender].배운특수능력.map(skill => skill.이름).join(", ") +
                 "\n사용할 스킬의 이름을 입력해주세요.\n예: '특수 불꽃 발사'";
        }
        const chosenSkillName = params.join(" ");
        if (!Game.variables.회원[sender].배운특수능력.some(skill => skill.이름 === chosenSkillName)) {
          return `배운 특수 능력 목록에 "${chosenSkillName}"가 없습니다. 사용 가능한 능력: ` +
                 Game.variables.회원[sender].배운특수능력.map(skill => skill.이름).join(", ");
        }
        const skill = Game.skillCache.find(s => s.이름 === chosenSkillName);
        if (!skill) return `스킬 데이터에 "${chosenSkillName}"에 해당하는 능력이 없습니다.`;
        if (Game.variables.회원[sender].MP < skill.MP소모) {
          return `MP가 부족합니다. "${skill.이름}" 사용에는 ${skill.MP소모} MP가 필요합니다. (현재 MP: ${Game.variables.회원[sender].MP})`;
        }
        Game.variables.회원[sender].MP -= skill.MP소모;

        if (Math.random() > (skill.명중률 ?? 1)) {
          Game.variables.회원[sender].pendingDecision.specialUsed = true;
          const monsterTurnOutput = await Game.functions.턴전투진행(sender, "자동공격");
          return `${sender}님의 "${skill.이름}" 공격이 빗나갔습니다!\n` + monsterTurnOutput;
        }

        let resultMsg = `${sender}님이(가) "${skill.이름}"을(를) 사용하였습니다.\n`;
        try {
          const idx = typeof skill.능력 === 'string' ? skill.능력.indexOf("=>") : -1;
          let skillFunc = null;
          if (typeof skill.능력 === 'function') skillFunc = skill.능력;
          else if (idx > -1) skillFunc = new Function("monster","user", skill.능력.slice(idx + 2));
          else skillFunc = (0, eval)(skill.능력);
          skillFunc(Game.variables.회원[sender].pendingDecision.monster, Game.variables.회원[sender]);
        } catch (e) {
          return `특수 기술 사용 실패: ${e.message}`;
        }
        resultMsg += skill.설명;
        Game.variables.회원[sender].pendingDecision.specialUsed = true;

        const monsterTurnOutput = await Game.functions.턴전투진행(sender, "일반");
        resultMsg += "\n" + monsterTurnOutput;
        return resultMsg;
      }
    },

    /* ────────────────────────────────────────────────
     * 온라인/대전(PvP) 관련 명령
     * ──────────────────────────────────────────────── */
    "온라인": {
      params: [],
      출력: async (sender, params) => {
        try {
          const r = await fetch('/api/online');
          const j = await r.json();
          if (!j.success) return "온라인 목록을 가져올 수 없습니다.";
          const list = (j.online || []).filter(u => u !== sender);
          return list.length ? `온라인: ${list.join(", ")}` : "현재 다른 온라인 플레이어가 없습니다.";
        } catch (e) {
          return "온라인 목록 조회 실패.";
        }
      }
    },
    "도전": {
      params: ["상대닉"],
      출력: async (sender, params) => {
        const target = params[0];
        if (!target) return "도전할 상대 닉네임을 입력하세요. 예: 도전 | rival";
        try {
          const r = await fetch('/api/pvp/challenge', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ from: sender, to: target })
          });
          const j = await r.json();
          if (!r.ok || !j.success) return `도전 실패: ${j.message || '서버 오류'}`;
          Game.variables.회원[sender].pvp = { duelId: j.duelId, opponent: target, status: 'pending', myRole: 'from' };
          return `${target}님에게 대전 요청을 보냈습니다. (duelId=${j.duelId})`;
        } catch (e) {
          return "도전 중 오류가 발생했습니다.";
        }
      }
    },
    "수락": {
      params: [],
      출력: async (sender, params) => {
        try {
          const r = await fetch('/api/pvp/accept', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ username: sender })
          });
          const j = await r.json();
          if (!r.ok || !j.success) return `수락 실패: ${j.message || '서버 오류'}`;
          const d = j.duel;
          const myRole = (d.from === sender) ? 'from' : 'to';
          const opp = (myRole === 'from') ? d.to : d.from;
          Game.variables.회원[sender].pvp = { duelId: d.id, opponent: opp, status: d.status, myRole, active: d.active };
          return `대전 수락! 상대: ${opp} / 선공: ${d.active === 'from' ? d.from : d.to}\nHP: 나 ${myRole==='from'?d.a.hp:d.b.hp}, 상대 ${myRole==='from'?d.b.hp:d.a.hp}`;
        } catch (e) {
          return "수락 처리 중 오류가 발생했습니다.";
        }
      }
    },
    "거절": {
      params: [],
      출력: async (sender, params) => {
        try {
          const r = await fetch('/api/pvp/reject', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ username: sender })
          });
          const j = await r.json();
          if (!r.ok || !j.success) return `거절 실패: ${j.message || '서버 오류'}`;
          Game.variables.회원[sender].pvp = null;
          return "대전 요청을 거절했습니다.";
        } catch (e) {
          return "거절 처리 중 오류가 발생했습니다.";
        }
      }
    },
    "대전공격": {
      params: [],
      출력: async (sender, params) => Game.functions._pvpAction(sender, "공격")
    },
    "대전일반": {
      params: [],
      출력: async (sender, params) => Game.functions._pvpAction(sender, "일반")
    },
    "대전방어": {
      params: [],
      출력: async (sender, params) => Game.functions._pvpAction(sender, "방어")
    },
    "항복": {
      params: [],
      출력: async (sender, params) => {
        const pvp = Game.variables.회원[sender].pvp;
        if (!pvp?.duelId) return "진행 중인 대전이 없습니다.";
        try {
          // 항복은 단순히 상태를 finished로 만들도록 HP=0 처리(서버 액션 한 번 호출)
          const r = await fetch('/api/pvp/action', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ duelId: pvp.duelId, actor: sender, action: '공격' }) // 최소 액션으로 마무리 유도
          });
          const j = await r.json();
          Game.variables.회원[sender].pvp = null;
          return "항복했습니다. (대전 종료)";
        } catch (e) {
          return "항복 처리 실패.";
        }
      }
    }
  },
  functions: {
    "회원확인": (sender) => !!Game.variables.회원[sender],
    "레벨업확인": (sender) => {
      let msg = "";
      let threshold = Math.floor(Game.variables.회원[sender].레벨 ** 4 * 5);
      while (Game.variables.회원[sender].경험치 >= threshold) {
        Game.variables.회원[sender].경험치 -= threshold;
        Game.variables.회원[sender].레벨++;
        let attackIncrease = Math.floor((Game.variables.회원[sender].레벨 + 2) ** 2);
        Game.variables.회원[sender].공격력 += attackIncrease;
        const newMaxHP = Game.functions.getMaxHP(Game.variables.회원[sender]);
        const newMaxMP = Game.functions.getMaxMP(Game.variables.회원[sender]);
        Game.variables.회원[sender].체력 = newMaxHP;
        Game.variables.회원[sender].MP = newMaxMP;
        msg += `축하합니다! 레벨 ${Game.variables.회원[sender].레벨}로 업그레이드되었습니다. (공격력 +${Game.functions.formatNumber(attackIncrease)}, 체력 회복됨: ${Game.functions.formatNumber(newMaxHP)}, MP 회복됨: ${Game.functions.formatNumber(newMaxMP)})\n`;
        threshold = Math.floor((Game.variables.회원[sender].레벨 + 1) ** 4 * 5);
      }
      return msg;
    },
    "보스확인": (sender, location) => {
      const BossRoomsObject = {
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
        "마왕의 방": "마왕",
      };
      const bossRoom = {
        bossName: BossRoomsObject[location],
        isCleared: () => Game.variables.회원[sender].퀘스트완료[BossRoomsObject[location]]
      };
      if (bossRoom.bossName && !bossRoom.isCleared()) {
        return `보스 '${bossRoom.bossName}'의 처치가 완료되지 않았습니다. 반드시 처치 후 이동할 수 있습니다.`;
      }
      return null;
    },
    "스토리처리": (sender, commandKey) => {
      if (Game.variables.회원[sender]) {
        if (Game.variables.회원[sender].스토리진행중 && commandKey !== "다음") {
          return "현재 스토리가 진행 중입니다. '다음'을 입력하여 스토리를 진행하세요.";
        }
        const locationKey = `${Game.variables.회원[sender].위치}_${Game.variables.회원[sender].세부위치}`;
        if (!Game.variables.회원[sender].세부방문.includes(locationKey) && !Game.variables.회원[sender].스토리진행중 && commandKey !== "다음") {
          Game.variables.회원[sender].스토리진행중 = true;
          Game.variables.회원[sender].스토리인덱스 = 0;
          const locationData = Game.variables.game.지도?.[Game.variables.회원[sender].위치]?.[Game.variables.회원[sender].세부위치];
          if (locationData?.스토리?.length > 0) {
            return locationData.스토리[Game.variables.회원[sender].스토리인덱스];
          }
        }
      }
      return null;
    },
    "파라미터입력요청": (currentParams, sender) => {
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
        inputDiv.innerHTML =
          '<input type="text" id="pendingInput" placeholder="여기에 입력하세요." style="width:100%;padding:5px;font-size:1.2em;">';
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
        if (commandKey === "특수" && nextParamName === "스킬명") {
          if (Game.variables.회원[sender]?.배운특수능력?.length > 0) {
            choices = Game.variables.회원[sender].배운특수능력.map(skill => skill.이름);
          } else {
            choices = ["보유한 스킬이 없습니다."];
          }
        } else if (Game.commands[commandKey].getChoices) {
          choices = [...(Game.commands[commandKey].getChoices(sender, currentParams) || [])];
        }
        if (!choices.includes("취소")) choices.push("취소");

        choices.forEach((choice, index) => {
          let button = document.createElement("button");
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
                  let newMsgDiv = document.createElement("div");
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
    "턴전투진행": async (sender, action) => {
      const user = Game.variables.회원[sender];
      let battle = user?.pendingDecision;
      if (!battle || battle.type !== "턴전투") {
        return "현재 진행 중인 전투가 없습니다.";
      }
      if (!battle.buffs) battle.buffs = { user: {}, monster: {} };

      let output = "";
      let attackMultiplier = 1.0;
      let defendMultiplier = 1.0;
      let skipPlayerAttack = false;

      // 전술 처리
      if (action && action.startsWith("전술")) {
        const parts = action.split(" ");
        const tactic = (parts[1] || "").trim();
        if (tactic === "차지") {
          battle.buffs.user.charge = true;
          output += "🔶 차지: 다음 공격의 위력이 크게 증가합니다.\n";
          // 몬스터 반격만 진행
          action = "자동공격";
          skipPlayerAttack = true;
        } else if (tactic === "연타") {
          // 두 번 공격(0.7x씩)
          let dmg1 = Math.max(0, Math.round(user.공격력 * 0.7 - ((battle.monster.방어력 || 0) * 0.5)));
          let dmg2 = Math.max(0, Math.round(user.공격력 * 0.7 - ((battle.monster.방어력 || 0) * 0.5)));
          if (battle.buffs.user.charge) { // 차지 적용 시 첫 타에만 2.0x
            dmg1 = Math.round(dmg1 * 2.0);
            battle.buffs.user.charge = false;
          }
          battle.monster.체력 -= dmg1;
          output += `연타 1타 명중! ${Game.functions.formatNumber(dmg1)} 피해 (몬스터 체력: ${Game.functions.formatNumber(battle.monster.체력)})\n`;
          if (battle.monster.체력 > 0) {
            battle.monster.체력 -= dmg2;
            output += `연타 2타 명중! ${Game.functions.formatNumber(dmg2)} 피해 (몬스터 체력: ${Game.functions.formatNumber(battle.monster.체력)})\n`;
          }
          if (battle.monster.체력 <= 0) {
            // 종료 루틴 공통 사용 위해 플래그만 세우고 아래 공통 처리
          }
        } else if (tactic === "가드브레이크") {
          battle.buffs.monster.guardBreakTurns = Math.max(1, (battle.buffs.monster.guardBreakTurns || 0)) + 1;
          output += "🛠️ 가드브레이크: 몬스터의 방어력이 잠시 약화됩니다.\n";
          // 이번 턴엔 약화만 걸고, 자동 반격
          action = "자동공격";
          skipPlayerAttack = true;
        } else if (tactic === "회피") {
          battle.buffs.user.evade = true;
          output += "🌀 회피: 다음 몬스터의 반격을 회피할 확률이 크게 증가합니다.\n";
          action = "자동공격";
          skipPlayerAttack = true;
        } else {
          return "전술은 차지/연타/가드브레이크/회피 중에서 선택하세요.";
        }
      }

      // 특수(스킬명) 분기
      if (action && action.startsWith("특수")) {
        const parts = action.split(" ");
        if (parts.length < 2) return "사용할 특수 능력을 입력하세요. 예: 특수 불꽃 발사";
        const skillName = parts.slice(1).join(" ");
        const owned = (user.배운특수능력 || []).find(s => s.이름 === skillName);
        if (!owned) return `배운 기술 중 ${skillName}이(가) 없습니다.`;
        if (user.MP < owned.MP소모) return `MP가 부족합니다. ${owned.MP소모} MP 소모가 필요합니다.`;

        user.MP -= owned.MP소모;

        // 명중 체크
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

      // 일반/공격/방어/자동공격 계수
      if (action === "공격") { attackMultiplier = 1.5; defendMultiplier = 1.5; }
      else if (action === "일반") { attackMultiplier = 1.0; defendMultiplier = 1.0; }
      else if (action === "방어") { attackMultiplier = 0.5; defendMultiplier = 0.5; }
      else if (action === "자동공격") { skipPlayerAttack = true; attackMultiplier = 0.0; defendMultiplier = 1.0; }
      else { /* 전술이 처리했을 수 있음 */ }

      // 몬스터 가드브레이크 약화 적용
      let monsterDef = battle.monster.방어력 || 0;
      if ((battle.buffs.monster.guardBreakTurns || 0) > 0) {
        monsterDef = Math.floor(monsterDef * 0.5);
      }

      // 플레이어 공격
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

      // 사망/부활 체크(플레이어)
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

      // 몬스터 사망 처리
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
          return output;
        }
      }

      // 몬스터 특수능력 (확률)
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
          battle.monster.MP = Math.max(0, (battle.monster.MP || 0) - (battle.monster.특수능력?.MP소모 || 0));
          output += `몬스터 특수능력 사용 후 남은 MP: ${battle.monster.MP}\n`;
          battle.initiative = "player";
          user.pendingDecision = battle;
          const levelUpMsg = Game.functions.레벨업확인(sender);
          if (levelUpMsg) output += levelUpMsg;
          output += "플레이어의 공격 차례입니다. (사용 가능한 명령어: 공격, 일반, 방어, 전술, 특수)";
          return output;
        }
      }

      // 몬스터 반격(회피 체크)
      const userSpeed = Number(user.속도 || 0);
      const monSpeed = Number(battle.monster.속도 || 0);
      let counterHitChance = (Number(user.명중률) || 0) + (userSpeed * 0.01) - (monSpeed * 0.01);
      if (battle.buffs.user.evade) {
        // 회피 시 반격 빗나갈 확률 대폭 증가
        counterHitChance -= 0.5;
      }
      if (Math.random() > counterHitChance) {
        output += "몬스터의 반격이 빗나갔습니다!\n";
      } else {
        let monsterDefMul = defendMultiplier;
        let monsterDamage = Math.round((battle.monster.공격력 * monsterDefMul) - ((user.방어력 || 0) * 0.5));
        monsterDamage = Math.max(monsterDamage, 0);
        user.체력 -= monsterDamage;
        output += `몬스터의 반격! ${Game.functions.formatNumber(monsterDamage)}의 피해를 받았습니다. (플레이어 체력: ${Game.functions.formatNumber(user.체력)})\n`;
      }
      // 회피 버프 일회성 소모
      if (battle.buffs.user.evade) battle.buffs.user.evade = false;

      // 장비 특수능력(피격 후/턴 종료 트리거)
      const equipmentList = await Game.variables.game.장비;
      if (Array.isArray(user.장착장비) && equipmentList) {
        for (const equipName of user.장착장비) {
          const equippedItem = equipmentList.find(item => item.이름 === equipName);
          if (equippedItem && equippedItem.능력) {
            try {
              let fn = null;
              if (typeof equippedItem.능력 === "function") fn = equippedItem.능력;
              else if (equippedItem.능력 && typeof equippedItem.능력.능력 !== "undefined") {
                fn = typeof equippedItem.능력.능력 === "function" ? equippedItem.능력.능력 : (0, eval)(equippedItem.능력.능력);
              } else if (typeof equippedItem.능력 === "string") {
                const idx = equippedItem.능력.indexOf("=>");
                fn = idx > -1 ? new Function("monster","user", equippedItem.능력.slice(idx + 2)) : (0, eval)(equippedItem.능력);
              }
              if (typeof fn === "function") {
                fn(battle.monster, user);
                if (equippedItem.능력?.설명) {
                  output += `[${equippedItem.이름}] 특수능력 발동! ${equippedItem.능력.설명}\n`;
                }
              }
            } catch (e) {
              console.warn("장비 능력 실행 오류:", e);
            }
          }
        }
      }

      // 가드브레이크 잔턴 감소
      if ((battle.buffs.monster.guardBreakTurns || 0) > 0) {
        battle.buffs.monster.guardBreakTurns -= 1;
      }

      // 다음 턴 준비
      battle.initiative = "player";
      const levelUpMsg = Game.functions.레벨업확인(sender);
      if (levelUpMsg) output += levelUpMsg;
      user.pendingDecision = battle;
      output += "플레이어의 공격 차례입니다. (사용 가능한 명령어: 공격, 일반, 방어, 전술, 특수)";
      return output;
    },

    // PvP 공통 액션
    "_pvpAction": async (sender, action) => {
      const me = Game.variables.회원[sender];
      const pvp = me?.pvp;
      if (!pvp?.duelId) return "진행 중인 대전이 없습니다.";
      try {
        const r = await fetch('/api/pvp/action', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ duelId: pvp.duelId, actor: sender, action })
        });
        const j = await r.json();
        if (!r.ok || !j.success) return `행동 실패: ${j.message || '서버 오류'}`;

        // 서버가 최신 상태를 돌려준다고 가정
        const d = j.duel;
        if (!d) return "대전 상태를 받아오지 못했습니다.";

        const myRole = (d.from === sender) ? 'from' : 'to';
        const opp = (myRole === 'from') ? d.to : d.from;
        me.pvp = { duelId: d.id, opponent: opp, status: d.status, myRole, active: d.active };

        const myState = (myRole === 'from') ? d.a : d.b;
        const oppState = (myRole === 'from') ? d.b : d.a;
        let msg = `대전 ${action} 수행!\n나 HP: ${Game.functions.formatNumber(myState.hp)} / 상대 HP: ${Game.functions.formatNumber(oppState.hp)}\n`;

        if (d.status === 'finished' || myState.hp <= 0 || oppState.hp <= 0) {
          me.pvp = null;
          msg += (myState.hp > 0 ? "승리했습니다!" : "패배했습니다...") + " (대전 종료)";
        } else {
          msg += `턴: ${d.active === 'from' ? d.from : d.to}`;
        }
        return msg;
      } catch (e) {
        return "대전 액션 처리 중 오류가 발생했습니다.";
      }
    },

    // UI & 권한
    "isCommandVisible": async (commandName, sender) => {
      const user = Game.variables.회원[sender];

      // 로그인/회원가입 노출
      if (!user) return ["회원가입","로그인"].includes(commandName);

      // 전투 중 제한
      if (user.pendingDecision) {
        const pend = user.pendingDecision;
        if (pend.awaitingConfirmation) {
          return ["예","아니오","상태"].includes(commandName);
        }
        if (pend.type === "턴전투") {
          return ["공격","일반","방어","전술","특수","상태","저장"].includes(commandName);
        }
      }

      // PvP 관련 노출
      if (["도전","온라인"].includes(commandName)) return true;
      if (["수락","거절"].includes(commandName)) return true;
      if (["대전공격","대전일반","대전방어","항복"].includes(commandName)) {
        return !!user.pvp;
      }

      switch (commandName) {
        case "회원가입":
        case "로그인":
          return !user;
        case "다음":
          return user.스토리진행중;
        case "상태":
        case "이동":
        case "탐험":
        case "지도":
        case "저장":
        case "보스와 전투":
        case "숙박":
          return true;
        case "구매":
          return user.세부위치 === "무기 상점";
        case "특수구매":
          return user.세부위치 === "기술 상점";
        case "장착":
          return Array.isArray(user.소유장비) && user.소유장비.length > 0;
        case "예":
        case "아니오":
          return !!user.pendingDecision;
        default:
          return true;
      }
    },

    "updateCommandVisibility": async (sender) => {
      if (document.getElementById("pendingInput") || document.querySelector('#buttons button[data-temp="true"]')) return;
      const buttons = document.querySelectorAll('#buttons button');

      const user = Game.variables.회원[sender];
      if (user?.스토리진행중) {
        buttons.forEach(btn => btn.style.display = (btn.dataset.command === "다음") ? 'inline-block' : 'none');
      } else {
        for (const btn of buttons) {
          const cmd = btn.dataset.command;
          const isVisible = await Game.functions.isCommandVisible(cmd, sender);
          btn.style.display = isVisible ? 'inline-block' : 'none';
        }
      }

      const visibleButtons = Array.from(document.querySelectorAll('#buttons button')).filter(b => b.style.display !== 'none');
      const extraKeys = "qwertyuiopasdfghjklzxcvbnm";
      visibleButtons.forEach((button, index) => {
        let shortcut;
        if (index < 10) shortcut = (index === 9) ? "0" : String(index + 1);
        else shortcut = extraKeys[index - 10] || "";
        let shortcutSpan = button.querySelector('.shortcut-key');
        if (!shortcutSpan) {
          shortcutSpan = document.createElement('span');
          shortcutSpan.classList.add('shortcut-key');
          button.appendChild(shortcutSpan);
        }
        shortcutSpan.textContent = shortcut;
      });
    },

    "스킬사용": (skillName, sender, monster) => {
      const 스킬목록 = Game["절대특수능력"];
      const skill = 스킬목록[skillName];
      if (!skill) return `${skillName} 스킬을 찾을 수 없습니다.`;
      if (Game.variables.회원[sender].MP < skill.MP소모) return "MP가 부족합니다.";
      Game.variables.회원[sender].MP -= skill.MP소모;
      if (Math.random() > skill.명중률) return "스킬 사용이 빗나갔습니다.";
      skill.능력(monster, Game.variables.회원[sender]);
      return `${skillName} 스킬을 성공적으로 사용하였습니다.`;
    },

    "renderMainButtons": () => {
      let buttonGroup = document.getElementById('buttons');
      if (!buttonGroup) {
        buttonGroup = document.createElement('div');
        buttonGroup.id = 'buttons';
        document.body.appendChild(buttonGroup);
      }
      buttonGroup.innerHTML = "";
      for (let command in Game.commands) {
        const button = document.createElement('button');
        button.textContent = command;
        button.dataset.command = command;
        button.addEventListener('click', async () => {
          const reply = await Game.reply(command, currentSender);
          if (reply !== null && typeof reply !== 'undefined') {
            const outputElem = document.getElementById('output') || (() => {
              const d = document.createElement('div'); d.id = 'output'; document.body.prepend(d); return d;
            })();
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

    "getMaxHP": (senderObj) => {
      let maxHP = 120;
      for (let i = 1; i <= senderObj.레벨 - 1; i++) {
        maxHP += Math.floor((i + 2) ** 2 * 10);
      }
      return maxHP;
    },

    "getMaxMP": (senderObj) => {
      let maxMP = 50;
      for (let i = 1; i <= senderObj.레벨 - 1; i++) {
        maxMP += Math.floor((i + 2) * 20);
      }
      return maxMP;
    },

    "formatNumber": (num) => {
      if (typeof num !== 'number' || !isFinite(num)) return String(num);
      if (num < 10000) return num.toString();
      const units = ["만", "억", "조", "경", "해", "자", "양", "구", "간", "정", "재", "극"];
      let unitIndex = Math.floor((Math.log10(num) - 4) / 4);
      unitIndex = Math.max(0, Math.min(unitIndex, units.length - 1));
      const divisor = Math.pow(10000, unitIndex + 1);
      const value = num / divisor;
      let formatted;
      if (unitIndex === 0) {
        formatted = Math.floor(value).toString();
      } else {
        formatted = (Math.floor(value * 10) / 10).toString();
        if (formatted.indexOf('.') !== -1 && formatted.split('.')[1] === "0") {
          formatted = formatted.split('.')[0];
        }
      }
      const remainder = num % divisor;
      return (remainder === 0 ? formatted : "약 " + formatted) + units[unitIndex];
    }
  },

  reply: async (input, sender) => {
    const tokens = input.split("|").map(t => t.trim());
    const commandKey = tokens[0];
    const paramsFromInput = tokens.slice(1);
    if (!Game.commands[commandKey]) return null;

    // 로그인 필수 보호
    if (!["회원가입","로그인"].includes(commandKey) && !Game.functions.회원확인(sender)) {
      return `${sender}님, 먼저 회원가입을 진행해주세요.`;
    }

    // 전투 중 제한 명령
    const user = Game.variables.회원[sender];
    if (user?.pendingDecision && commandKey !== "저장") {
      const pend = user.pendingDecision;
      const allowed = pend.awaitingConfirmation
        ? ["예","아니오","상태"]
        : ["공격","방어","일반","전술","특수","상태","예","아니오"];
      if (pend.type === "턴전투" && !allowed.includes(commandKey)) {
        return "전투 중에는 공격, 방어, 일반, 전술, 특수, 상태, 예/아니오만 사용 가능합니다.";
      }
    }

    // 스토리 우선 처리
    const storyCheck = Game.functions.스토리처리(sender, commandKey);
    if (storyCheck !== null) return storyCheck;

    // 파라미터 수집
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

// 데이터 로드 & 캐시
Game.variables.game = {
  "지도": fetch("./game/map.json")
    .then(r => r.json())
    .then(d => { Game.mapCache = d; return d; })
    .catch(e => { console.error("지도 데이터 로드 실패", e); return {}; }),
  "몬스터": fetch("./game/monster.json")
    .then(r => r.json())
    .catch(e => { console.error("몬스터 데이터 로드 실패", e); return {}; }),
  "장비": fetch("./game/equipment.json")
    .then(r => r.json())
    .then(d => { Game.equipmentCache = d; return d; })
    .catch(e => { console.error("장비 데이터 로드 실패", e); return []; }),
  "기술": fetch("./game/skill.json")
    .then(r => r.json())
    .then(d => { Game.skillCache = d; return d; })
    .catch(e => { console.error("기술 데이터 로드 실패", e); return []; })
};

// 초기 버튼 렌더링
Game.functions.renderMainButtons();

// 단축키(숫자)
document.addEventListener("keydown", (event) => {
  if (document.activeElement &&
      (/^(input|textarea)$/i).test(document.activeElement.tagName)) return;

  const validKeys = ["1","2","3","4","5","6","7","8","9","0"];
  if (validKeys.includes(event.key)) {
    event.preventDefault();
    event.stopPropagation();
    const visibleButtons = Array.from(document.querySelectorAll('#buttons button')).filter(b => b.style.display !== 'none');
    const index = (event.key === "0") ? 9 : (parseInt(event.key, 10) - 1);
    if (index < visibleButtons.length) visibleButtons[index].click();
  }
});

// 주기적 버튼 가시성 갱신
setInterval(() => Game.functions.updateCommandVisibility(currentSender), 100);