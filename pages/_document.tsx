import Document, { Html, Head, Main, NextScript } from 'next/document';
import type { DocumentContext } from 'next/document';

class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx);
    // The nonce is set by middleware.ts via the x-nonce request header.
    const nonce = ctx.req?.headers['x-nonce'] as string | undefined;
    return { ...initialProps, nonce };
  }

  render() {
    const { nonce } = this.props as { nonce?: string } & typeof this.props;
    return (
      <Html lang="he">
        <Head nonce={nonce} />
        <body>
          <Main />
          <NextScript nonce={nonce} />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
