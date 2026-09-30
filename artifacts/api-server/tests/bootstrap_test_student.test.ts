import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapTestStudent } from '../scripts/bootstrapTestStudent';

describe('BOOTSTRAP-STUDENT: Safe Test Student Persona Suite', () => {
  it('strictly fails closed when NODE_ENV is production', async () => {
    await assert.rejects(
      async () => {
        await bootstrapTestStudent({
          NODE_ENV: 'production',
        });
      },
      {
        message: /Refusing to bootstrap test student in production mode/,
      }
    );
  });

  it('fails closed when password does not meet strength policy', async () => {
    await assert.rejects(
      async () => {
        await bootstrapTestStudent({
          NODE_ENV: 'test',
          TEST_STUDENT_EMAIL: 'student.test@university.local',
          TEST_STUDENT_PASSWORD: 'weak',
        });
      },
      {
        message: /Invalid password:/,
      }
    );
  });

  it('fails closed on invalid email format', async () => {
    await assert.rejects(
      async () => {
        await bootstrapTestStudent({
          NODE_ENV: 'test',
          TEST_STUDENT_EMAIL: 'not-an-email',
          TEST_STUDENT_PASSWORD: 'ValidPassword123!',
        });
      },
      {
        message: /Invalid email format/,
      }
    );
  });

  it('successfully creates or updates deterministic test student persona in non-production', async () => {
    const res = await bootstrapTestStudent({
      NODE_ENV: 'test',
      TEST_STUDENT_EMAIL: 'student.test@university.local',
      TEST_STUDENT_PASSWORD: 'StudentTest123!',
    });

    assert.equal(res.success, true);
    assert.equal(res.student?.email, 'student.test@university.local');
    assert.equal(res.student?.role, 'STUDENT');
  });
});
