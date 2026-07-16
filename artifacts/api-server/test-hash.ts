import bcrypt from 'bcryptjs';

async function check() {
  const hash = '$2b$10$8Tvjm2XWVHay0Iin8hi/GeyOrk1U7Ev3tDiZBT8PKi.A0Lyh9kfSa';
  const match = await bcrypt.compare('Password123!', hash);
  console.log('Match?', match);
}
check();
