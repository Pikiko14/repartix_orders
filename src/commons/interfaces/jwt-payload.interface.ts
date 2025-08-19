export interface JwtPayloadInterface {
  id: string;
  parent: string | null;
  scopes: string[];
}
