import dotenv from "dotenv";

dotenv.config({ quiet: true });

const normalizedNodeEnvironment = process.env.NODE_ENV?.trim().toLowerCase();
if (normalizedNodeEnvironment) {
  process.env.NODE_ENV = normalizedNodeEnvironment;
}
