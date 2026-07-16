async function main() {
    const docRes = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'doctor@university.com', password: 'password123' })
    });
    const docData = await docRes.json();
    console.log('Doc login:', docData.success);
    let token = docData.token;

    if(token) {
        const rosterRes = await fetch('http://localhost:5000/api/courses/1/roster?sectionId=3&date=2026-07-07T00:00:00.000Z', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const rosterData = await rosterRes.json();
        console.log('Roster API:', JSON.stringify(rosterData, null, 2));
    }
}
main();
