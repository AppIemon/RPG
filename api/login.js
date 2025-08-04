import { dbConnect, Member, Data } from '../lib/db';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === "POST") {
    const { username, password } = req.body;
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
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}