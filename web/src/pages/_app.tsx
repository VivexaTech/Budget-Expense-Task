import type { AppProps } from 'next/app';
import Head from 'next/head';
import { AuthProvider } from '../lib/authContext';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <Head>
        <title>CompanyBudget SaaS — Multi-Company Financial Management</title>
        <meta
          name="description"
          content="Enterprise budget, expense management, invoice generator, and task-funded financial operations platform."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Component {...pageProps} />
    </AuthProvider>
  );
}
