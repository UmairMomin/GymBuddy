import { deleteE2EUsers } from "./helpers/cleanup";

/** Runs even when tests fail, so no test account or data survives a run. */
export default async function globalTeardown() {
  const n = await deleteE2EUsers();
  console.log(`[e2e] cleaned up ${n} test account(s)`);
}
