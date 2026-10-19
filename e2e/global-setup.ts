import { deleteE2EUsers } from "./helpers/cleanup";

/** Remove accounts left behind by a crashed earlier run. */
export default async function globalSetup() {
  const n = await deleteE2EUsers();
  if (n > 0) console.log(`[e2e] removed ${n} stale test account(s)`);
}
