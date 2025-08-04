import { dbConnect, Member, Data } from '../lib/db';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === "POST") {
    const memberData = req.body;

    if (memberData.isNewRegistration) {
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

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+={}\[\]|\\:;"'<>,.?\/~]).{8,}$/;
    if (!passwordRegex.test(memberData.password)) {
      return res.status(400).json({ 
        success: false, 
        message: "비밀번호는 최소 8자 이상이며, 대문자, 숫자, 특수문자를 포함해야 합니다." 
      });
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
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}