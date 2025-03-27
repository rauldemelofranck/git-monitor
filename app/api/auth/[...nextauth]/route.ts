import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { JWT } from "next-auth/jwt";
import { Session } from "next-auth";

interface AuthToken extends JWT {
  accessToken?: string;
}

interface AuthSession extends Session {
  accessToken?: string;
}

export const authOptions = {
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "repo read:org",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }: { token: AuthToken; account: any }) {
      // Persist the OAuth access_token to the token right after signin
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }: { session: AuthSession; token: AuthToken }) {
      // Send properties to the client, like an access_token
      session.accessToken = token.accessToken;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }; 