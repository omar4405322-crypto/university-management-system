const jwt = require('jsonwebtoken');

async function main() {
  const token = jwt.sign(
    { id: 1, tokenVersion: 3 },
    'my-super-secret-jwt-key-that-is-long-enough-32chars',
    { expiresIn: '1h', issuer: 'Smart University Platform', audience: 'University Users' }
  );

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  try {
    const rosterReq = await fetch('http://localhost:5000/api/courses/1/roster', { headers });
    const rosterRes = await rosterReq.json();
    console.log("=== GET ROSTER ===");
    console.log("Status:", rosterReq.status);
    console.log("Body:", JSON.stringify(rosterRes, null, 2));

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const payload = {
      courseId: 1,
      date: tomorrow.toISOString().split('T')[0], // Simulate frontend payload
      records: [
        { studentId: rosterRes.data[0].id, status: 'PRESENT', remarks: 'First Save' }
      ]
    };
    
    console.log("\n=== FIRST SAVE ===");
    const save1Req = await fetch('http://localhost:5000/api/attendance', { method: 'POST', headers, body: JSON.stringify(payload) });
    const save1 = await save1Req.json();
    console.log("Status:", save1Req.status);
    console.log("Body:", JSON.stringify(save1, null, 2));

    payload.records[0].remarks = 'Second Save - Upsert Test';
    console.log("\n=== SECOND SAVE (UPSERT) ===");
    const save2Req = await fetch('http://localhost:5000/api/attendance', { method: 'POST', headers, body: JSON.stringify(payload) });
    const save2 = await save2Req.json();
    console.log("Status:", save2Req.status);
    console.log("Body:", JSON.stringify(save2, null, 2));

  } catch(e) {
    console.log("Error:", e.message);
  }
}
main();
