import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import { compare } from 'bcryptjs';
import type { NextAuthOptions } from 'next-auth';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Master admin credential fallback (ssrealtyteams@gmail.com / Admin@123)
        if (
          credentials.email === 'ssrealtyteams@gmail.com' &&
          credentials.password === 'Admin@123'
        ) {
          return { id: 'admin-master', email: 'ssrealtyteams@gmail.com', name: 'SS Realty Admin' };
        }

        try {
          const user = await prisma.adminUser.findUnique({
            where: { email: credentials.email as string },
          });

          if (!user) return null;

          const isValid = await compare(credentials.password as string, user.password);
          if (!isValid) return null;

          return { id: user.id, email: user.email, name: 'SS Realty Admin' };
        } catch {
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
