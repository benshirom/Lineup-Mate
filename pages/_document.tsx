import Document, {
  Html,
  Head,
  Main,
  NextScript,
  DocumentContext,
  DocumentInitialProps,
} from 'next/document';

interface DocumentProps extends DocumentInitialProps {
  nonce?: string;
}

export default class MyDocument extends Document<DocumentProps> {
  static async getInitialProps(ctx: DocumentContext): Promise<DocumentProps> {
    const nonce = ctx.res?.getHeader('x-nonce') as string | undefined;
    const initialProps = await Document.getInitialProps(ctx);
    return { ...initialProps, nonce };
  }

  render() {
    const { nonce } = this.props;
    return (
      <Html>
        <Head>
          {/* Belt-and-suspenders: ensures viewport-fit=cover is present in the
              static HTML before React hydration, so mobile browsers don't fill
              in their own default during the next/head update cycle. */}
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        </Head>
        <body>
          <Main />
          <NextScript nonce={nonce} />
        </body>
      </Html>
    );
  }
}
