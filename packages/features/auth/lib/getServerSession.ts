import { LRUCache } from "lru-cache";
import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from "next";
import type { AuthOptions, Session } from "next-auth";

import { CAL_URL } from "@calcom/lib/constants";
import prisma from "@calcom/prisma";

/**
 * Stores the session in memory using the stringified token as the key.
 *
 */
const CACHE = new LRUCache<string, Session>({ max: 1000 });

/**
 * This is a slimmed down version of the `getServerSession` function from
 * `next-auth`.
 *
 * Instead of requiring the entire options object for NextAuth, we create
 * a compatible session using information from the incoming token.
 *
 * The downside to this is that we won't refresh sessions if the users
 * token has expired (30 days). This should be fine as we call `/auth/session`
 * frequently enough on the client-side to keep the session alive.
 */
export async function getServerSession(options: {
  req: NextApiRequest | GetServerSidePropsContext["req"];
  res?: NextApiResponse | GetServerSidePropsContext["res"];
  authOptions?: AuthOptions;
}) {
  const { req, authOptions: { secret } = {} } = options;

  // const token = await getToken({
  //   req,
  //   secret,
  // });

  const mcnUidToken = req.cookies["mcn_uid"];
  const mcnUserId = +(!isNaN(req.headers["mcn-user-id"])
    ? (req.headers["mcn-user-id"] as string)
    : ("0" as string));

  console.log("TOKEEEEn", req.cookies, mcnUserId);

  // if (!token || !token.email || !token.sub) {
  //   return null;
  // }

  const cachedSession = CACHE.get(JSON.stringify(mcnUidToken));

  if (cachedSession) {
    return cachedSession;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: mcnUserId,
      // email: token.email.toLowerCase(),
    },
    // TODO: Re-enable once we get confirmation from compliance that this is okay.
    // cacheStrategy: { ttl: 60, swr: 1 },
  });

  if (!user) {
    return null;
  }

  // const hasValidLicense = await checkLicense(prisma);

  const session: Session = {
    hasValidLicense: true,
    expires: new Date("2024-12-15T22:39:30.465Z").toISOString(),
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      emailVerified: user.emailVerified,
      email_verified: user.emailVerified !== null,
      role: user.role,
      image: `${CAL_URL}/${user.username}/avatar.png`,
      // impersonatedByUID: token.impersonatedByUID ?? undefined,
      impersonatedByUID: undefined,
      // belongsToActiveTeam: token.belongsToActiveTeam,
      belongsToActiveTeam: false,
      // org: token.org,
      org: undefined,
      locale: user.locale ?? undefined,
    },
  };

  CACHE.set(JSON.stringify(mcnUidToken), session);

  console.log("SESSSION GETSERVERSESSION", session);
  return session;
}
