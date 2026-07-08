import "react";

declare module "react" {
  // `<T>` is unused in the body but required — TypeScript's declaration
  // merging rejects augmenting a generic interface with a non-generic
  // one, so it must be repeated here even though nothing below uses it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}