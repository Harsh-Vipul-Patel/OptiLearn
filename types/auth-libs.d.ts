declare module 'jsonwebtoken' {
  export interface JwtPayload {
    [key: string]: unknown
  }

  export function sign(
    payload: string | Buffer | object,
    secretOrPrivateKey: string,
    options?: { expiresIn?: string | number; algorithm?: string }
  ): string

  export function verify(
    token: string,
    secretOrPublicKey: string,
    options?: { algorithms?: string[] }
  ): JwtPayload | string

  export default {
    sign,
    verify,
  }
}

declare module 'bcryptjs' {
  export function hash(s: string, salt: number | string): Promise<string>
  export function compare(s: string, hash: string): Promise<boolean>
  export function hashSync(s: string, salt: number | string): string
  export function compareSync(s: string, hash: string): boolean
  export function genSaltSync(rounds?: number): string
  export function genSalt(rounds?: number): Promise<string>
}
