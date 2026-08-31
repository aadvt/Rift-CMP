
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model Organisation
 * A tenant. Every website belongs to exactly one organisation, and the
 * organisation is the boundary that isolation is enforced against.
 */
export type Organisation = $Result.DefaultSelection<Prisma.$OrganisationPayload>
/**
 * Model Website
 * 
 */
export type Website = $Result.DefaultSelection<Prisma.$WebsitePayload>
/**
 * Model Session
 * 
 */
export type Session = $Result.DefaultSelection<Prisma.$SessionPayload>
/**
 * Model Event
 * 
 */
export type Event = $Result.DefaultSelection<Prisma.$EventPayload>
/**
 * Model Principal
 * A data principal - the person a consent decision belongs to.
 * 
 * Scoped to a site, because that is the grain the SDK authenticates at. For the
 * MVP a principal is anonymous: `externalId` is an opaque, high-entropy id the
 * SDK stores in the browser. `kind` allows later promotion to an identified
 * principal without a schema change.
 */
export type Principal = $Result.DefaultSelection<Prisma.$PrincipalPayload>
/**
 * Model Purpose
 * Something a fiduciary uses data for. Referenced by stable `code`, so the SDK
 * and notices can name a purpose without knowing its UUID.
 */
export type Purpose = $Result.DefaultSelection<Prisma.$PurposePayload>
/**
 * Model Policy
 * A policy document owned by a fiduciary. The text itself lives in versions.
 */
export type Policy = $Result.DefaultSelection<Prisma.$PolicyPayload>
/**
 * Model PolicyVersion
 * An immutable version of a policy. Consent is always recorded against the
 * version that was in force, so the audit trail stays meaningful after the
 * policy text changes.
 */
export type PolicyVersion = $Result.DefaultSelection<Prisma.$PolicyVersionPayload>
/**
 * Model Notice
 * What was actually shown to a principal at collection time: a policy version,
 * in a locale, disclosing a specific set of purposes.
 */
export type Notice = $Result.DefaultSelection<Prisma.$NoticePayload>
/**
 * Model NoticePurpose
 * Which purposes a notice disclosed.
 */
export type NoticePurpose = $Result.DefaultSelection<Prisma.$NoticePurposePayload>
/**
 * Model ConsentRecord
 * One immutable consent decision. This table is append-only: a database trigger
 * rejects UPDATE, so a recorded decision can never be rewritten or silently
 * overwritten. DELETE is not blocked, because tenant offboarding cascades from
 * `organisations`; retention and erasure are a separate concern from
 * immutability. "Current consent" is derived as the newest record per
 * (principal, purpose) - it is never stored as a mutable flag.
 */
export type ConsentRecord = $Result.DefaultSelection<Prisma.$ConsentRecordPayload>

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Organisations
 * const organisations = await prisma.organisation.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  const U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Organisations
   * const organisations = await prisma.organisation.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.organisation`: Exposes CRUD operations for the **Organisation** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Organisations
    * const organisations = await prisma.organisation.findMany()
    * ```
    */
  get organisation(): Prisma.OrganisationDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.website`: Exposes CRUD operations for the **Website** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Websites
    * const websites = await prisma.website.findMany()
    * ```
    */
  get website(): Prisma.WebsiteDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.session`: Exposes CRUD operations for the **Session** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Sessions
    * const sessions = await prisma.session.findMany()
    * ```
    */
  get session(): Prisma.SessionDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.event`: Exposes CRUD operations for the **Event** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Events
    * const events = await prisma.event.findMany()
    * ```
    */
  get event(): Prisma.EventDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.principal`: Exposes CRUD operations for the **Principal** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Principals
    * const principals = await prisma.principal.findMany()
    * ```
    */
  get principal(): Prisma.PrincipalDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.purpose`: Exposes CRUD operations for the **Purpose** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Purposes
    * const purposes = await prisma.purpose.findMany()
    * ```
    */
  get purpose(): Prisma.PurposeDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.policy`: Exposes CRUD operations for the **Policy** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Policies
    * const policies = await prisma.policy.findMany()
    * ```
    */
  get policy(): Prisma.PolicyDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.policyVersion`: Exposes CRUD operations for the **PolicyVersion** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PolicyVersions
    * const policyVersions = await prisma.policyVersion.findMany()
    * ```
    */
  get policyVersion(): Prisma.PolicyVersionDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.notice`: Exposes CRUD operations for the **Notice** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Notices
    * const notices = await prisma.notice.findMany()
    * ```
    */
  get notice(): Prisma.NoticeDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.noticePurpose`: Exposes CRUD operations for the **NoticePurpose** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more NoticePurposes
    * const noticePurposes = await prisma.noticePurpose.findMany()
    * ```
    */
  get noticePurpose(): Prisma.NoticePurposeDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.consentRecord`: Exposes CRUD operations for the **ConsentRecord** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ConsentRecords
    * const consentRecords = await prisma.consentRecord.findMany()
    * ```
    */
  get consentRecord(): Prisma.ConsentRecordDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 6.19.3
   * Query Engine version: c2990dca591cba766e3b7ef5d9e8a84796e47ab7
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import Bytes = runtime.Bytes
  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    Organisation: 'Organisation',
    Website: 'Website',
    Session: 'Session',
    Event: 'Event',
    Principal: 'Principal',
    Purpose: 'Purpose',
    Policy: 'Policy',
    PolicyVersion: 'PolicyVersion',
    Notice: 'Notice',
    NoticePurpose: 'NoticePurpose',
    ConsentRecord: 'ConsentRecord'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "organisation" | "website" | "session" | "event" | "principal" | "purpose" | "policy" | "policyVersion" | "notice" | "noticePurpose" | "consentRecord"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      Organisation: {
        payload: Prisma.$OrganisationPayload<ExtArgs>
        fields: Prisma.OrganisationFieldRefs
        operations: {
          findUnique: {
            args: Prisma.OrganisationFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrganisationPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.OrganisationFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrganisationPayload>
          }
          findFirst: {
            args: Prisma.OrganisationFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrganisationPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.OrganisationFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrganisationPayload>
          }
          findMany: {
            args: Prisma.OrganisationFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrganisationPayload>[]
          }
          create: {
            args: Prisma.OrganisationCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrganisationPayload>
          }
          createMany: {
            args: Prisma.OrganisationCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.OrganisationCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrganisationPayload>[]
          }
          delete: {
            args: Prisma.OrganisationDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrganisationPayload>
          }
          update: {
            args: Prisma.OrganisationUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrganisationPayload>
          }
          deleteMany: {
            args: Prisma.OrganisationDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.OrganisationUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.OrganisationUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrganisationPayload>[]
          }
          upsert: {
            args: Prisma.OrganisationUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrganisationPayload>
          }
          aggregate: {
            args: Prisma.OrganisationAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateOrganisation>
          }
          groupBy: {
            args: Prisma.OrganisationGroupByArgs<ExtArgs>
            result: $Utils.Optional<OrganisationGroupByOutputType>[]
          }
          count: {
            args: Prisma.OrganisationCountArgs<ExtArgs>
            result: $Utils.Optional<OrganisationCountAggregateOutputType> | number
          }
        }
      }
      Website: {
        payload: Prisma.$WebsitePayload<ExtArgs>
        fields: Prisma.WebsiteFieldRefs
        operations: {
          findUnique: {
            args: Prisma.WebsiteFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WebsitePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.WebsiteFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WebsitePayload>
          }
          findFirst: {
            args: Prisma.WebsiteFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WebsitePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.WebsiteFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WebsitePayload>
          }
          findMany: {
            args: Prisma.WebsiteFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WebsitePayload>[]
          }
          create: {
            args: Prisma.WebsiteCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WebsitePayload>
          }
          createMany: {
            args: Prisma.WebsiteCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.WebsiteCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WebsitePayload>[]
          }
          delete: {
            args: Prisma.WebsiteDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WebsitePayload>
          }
          update: {
            args: Prisma.WebsiteUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WebsitePayload>
          }
          deleteMany: {
            args: Prisma.WebsiteDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.WebsiteUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.WebsiteUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WebsitePayload>[]
          }
          upsert: {
            args: Prisma.WebsiteUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WebsitePayload>
          }
          aggregate: {
            args: Prisma.WebsiteAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateWebsite>
          }
          groupBy: {
            args: Prisma.WebsiteGroupByArgs<ExtArgs>
            result: $Utils.Optional<WebsiteGroupByOutputType>[]
          }
          count: {
            args: Prisma.WebsiteCountArgs<ExtArgs>
            result: $Utils.Optional<WebsiteCountAggregateOutputType> | number
          }
        }
      }
      Session: {
        payload: Prisma.$SessionPayload<ExtArgs>
        fields: Prisma.SessionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.SessionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.SessionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>
          }
          findFirst: {
            args: Prisma.SessionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.SessionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>
          }
          findMany: {
            args: Prisma.SessionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>[]
          }
          create: {
            args: Prisma.SessionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>
          }
          createMany: {
            args: Prisma.SessionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.SessionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>[]
          }
          delete: {
            args: Prisma.SessionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>
          }
          update: {
            args: Prisma.SessionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>
          }
          deleteMany: {
            args: Prisma.SessionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.SessionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.SessionUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>[]
          }
          upsert: {
            args: Prisma.SessionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>
          }
          aggregate: {
            args: Prisma.SessionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateSession>
          }
          groupBy: {
            args: Prisma.SessionGroupByArgs<ExtArgs>
            result: $Utils.Optional<SessionGroupByOutputType>[]
          }
          count: {
            args: Prisma.SessionCountArgs<ExtArgs>
            result: $Utils.Optional<SessionCountAggregateOutputType> | number
          }
        }
      }
      Event: {
        payload: Prisma.$EventPayload<ExtArgs>
        fields: Prisma.EventFieldRefs
        operations: {
          findUnique: {
            args: Prisma.EventFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EventPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.EventFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EventPayload>
          }
          findFirst: {
            args: Prisma.EventFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EventPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.EventFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EventPayload>
          }
          findMany: {
            args: Prisma.EventFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EventPayload>[]
          }
          create: {
            args: Prisma.EventCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EventPayload>
          }
          createMany: {
            args: Prisma.EventCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.EventCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EventPayload>[]
          }
          delete: {
            args: Prisma.EventDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EventPayload>
          }
          update: {
            args: Prisma.EventUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EventPayload>
          }
          deleteMany: {
            args: Prisma.EventDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.EventUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.EventUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EventPayload>[]
          }
          upsert: {
            args: Prisma.EventUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EventPayload>
          }
          aggregate: {
            args: Prisma.EventAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateEvent>
          }
          groupBy: {
            args: Prisma.EventGroupByArgs<ExtArgs>
            result: $Utils.Optional<EventGroupByOutputType>[]
          }
          count: {
            args: Prisma.EventCountArgs<ExtArgs>
            result: $Utils.Optional<EventCountAggregateOutputType> | number
          }
        }
      }
      Principal: {
        payload: Prisma.$PrincipalPayload<ExtArgs>
        fields: Prisma.PrincipalFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PrincipalFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PrincipalPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PrincipalFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PrincipalPayload>
          }
          findFirst: {
            args: Prisma.PrincipalFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PrincipalPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PrincipalFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PrincipalPayload>
          }
          findMany: {
            args: Prisma.PrincipalFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PrincipalPayload>[]
          }
          create: {
            args: Prisma.PrincipalCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PrincipalPayload>
          }
          createMany: {
            args: Prisma.PrincipalCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PrincipalCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PrincipalPayload>[]
          }
          delete: {
            args: Prisma.PrincipalDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PrincipalPayload>
          }
          update: {
            args: Prisma.PrincipalUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PrincipalPayload>
          }
          deleteMany: {
            args: Prisma.PrincipalDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PrincipalUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.PrincipalUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PrincipalPayload>[]
          }
          upsert: {
            args: Prisma.PrincipalUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PrincipalPayload>
          }
          aggregate: {
            args: Prisma.PrincipalAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePrincipal>
          }
          groupBy: {
            args: Prisma.PrincipalGroupByArgs<ExtArgs>
            result: $Utils.Optional<PrincipalGroupByOutputType>[]
          }
          count: {
            args: Prisma.PrincipalCountArgs<ExtArgs>
            result: $Utils.Optional<PrincipalCountAggregateOutputType> | number
          }
        }
      }
      Purpose: {
        payload: Prisma.$PurposePayload<ExtArgs>
        fields: Prisma.PurposeFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PurposeFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PurposePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PurposeFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PurposePayload>
          }
          findFirst: {
            args: Prisma.PurposeFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PurposePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PurposeFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PurposePayload>
          }
          findMany: {
            args: Prisma.PurposeFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PurposePayload>[]
          }
          create: {
            args: Prisma.PurposeCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PurposePayload>
          }
          createMany: {
            args: Prisma.PurposeCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PurposeCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PurposePayload>[]
          }
          delete: {
            args: Prisma.PurposeDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PurposePayload>
          }
          update: {
            args: Prisma.PurposeUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PurposePayload>
          }
          deleteMany: {
            args: Prisma.PurposeDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PurposeUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.PurposeUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PurposePayload>[]
          }
          upsert: {
            args: Prisma.PurposeUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PurposePayload>
          }
          aggregate: {
            args: Prisma.PurposeAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePurpose>
          }
          groupBy: {
            args: Prisma.PurposeGroupByArgs<ExtArgs>
            result: $Utils.Optional<PurposeGroupByOutputType>[]
          }
          count: {
            args: Prisma.PurposeCountArgs<ExtArgs>
            result: $Utils.Optional<PurposeCountAggregateOutputType> | number
          }
        }
      }
      Policy: {
        payload: Prisma.$PolicyPayload<ExtArgs>
        fields: Prisma.PolicyFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PolicyFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PolicyPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PolicyFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PolicyPayload>
          }
          findFirst: {
            args: Prisma.PolicyFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PolicyPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PolicyFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PolicyPayload>
          }
          findMany: {
            args: Prisma.PolicyFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PolicyPayload>[]
          }
          create: {
            args: Prisma.PolicyCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PolicyPayload>
          }
          createMany: {
            args: Prisma.PolicyCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PolicyCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PolicyPayload>[]
          }
          delete: {
            args: Prisma.PolicyDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PolicyPayload>
          }
          update: {
            args: Prisma.PolicyUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PolicyPayload>
          }
          deleteMany: {
            args: Prisma.PolicyDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PolicyUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.PolicyUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PolicyPayload>[]
          }
          upsert: {
            args: Prisma.PolicyUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PolicyPayload>
          }
          aggregate: {
            args: Prisma.PolicyAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePolicy>
          }
          groupBy: {
            args: Prisma.PolicyGroupByArgs<ExtArgs>
            result: $Utils.Optional<PolicyGroupByOutputType>[]
          }
          count: {
            args: Prisma.PolicyCountArgs<ExtArgs>
            result: $Utils.Optional<PolicyCountAggregateOutputType> | number
          }
        }
      }
      PolicyVersion: {
        payload: Prisma.$PolicyVersionPayload<ExtArgs>
        fields: Prisma.PolicyVersionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PolicyVersionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PolicyVersionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PolicyVersionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PolicyVersionPayload>
          }
          findFirst: {
            args: Prisma.PolicyVersionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PolicyVersionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PolicyVersionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PolicyVersionPayload>
          }
          findMany: {
            args: Prisma.PolicyVersionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PolicyVersionPayload>[]
          }
          create: {
            args: Prisma.PolicyVersionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PolicyVersionPayload>
          }
          createMany: {
            args: Prisma.PolicyVersionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PolicyVersionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PolicyVersionPayload>[]
          }
          delete: {
            args: Prisma.PolicyVersionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PolicyVersionPayload>
          }
          update: {
            args: Prisma.PolicyVersionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PolicyVersionPayload>
          }
          deleteMany: {
            args: Prisma.PolicyVersionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PolicyVersionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.PolicyVersionUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PolicyVersionPayload>[]
          }
          upsert: {
            args: Prisma.PolicyVersionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PolicyVersionPayload>
          }
          aggregate: {
            args: Prisma.PolicyVersionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePolicyVersion>
          }
          groupBy: {
            args: Prisma.PolicyVersionGroupByArgs<ExtArgs>
            result: $Utils.Optional<PolicyVersionGroupByOutputType>[]
          }
          count: {
            args: Prisma.PolicyVersionCountArgs<ExtArgs>
            result: $Utils.Optional<PolicyVersionCountAggregateOutputType> | number
          }
        }
      }
      Notice: {
        payload: Prisma.$NoticePayload<ExtArgs>
        fields: Prisma.NoticeFieldRefs
        operations: {
          findUnique: {
            args: Prisma.NoticeFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NoticePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.NoticeFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NoticePayload>
          }
          findFirst: {
            args: Prisma.NoticeFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NoticePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.NoticeFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NoticePayload>
          }
          findMany: {
            args: Prisma.NoticeFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NoticePayload>[]
          }
          create: {
            args: Prisma.NoticeCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NoticePayload>
          }
          createMany: {
            args: Prisma.NoticeCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.NoticeCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NoticePayload>[]
          }
          delete: {
            args: Prisma.NoticeDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NoticePayload>
          }
          update: {
            args: Prisma.NoticeUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NoticePayload>
          }
          deleteMany: {
            args: Prisma.NoticeDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.NoticeUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.NoticeUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NoticePayload>[]
          }
          upsert: {
            args: Prisma.NoticeUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NoticePayload>
          }
          aggregate: {
            args: Prisma.NoticeAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateNotice>
          }
          groupBy: {
            args: Prisma.NoticeGroupByArgs<ExtArgs>
            result: $Utils.Optional<NoticeGroupByOutputType>[]
          }
          count: {
            args: Prisma.NoticeCountArgs<ExtArgs>
            result: $Utils.Optional<NoticeCountAggregateOutputType> | number
          }
        }
      }
      NoticePurpose: {
        payload: Prisma.$NoticePurposePayload<ExtArgs>
        fields: Prisma.NoticePurposeFieldRefs
        operations: {
          findUnique: {
            args: Prisma.NoticePurposeFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NoticePurposePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.NoticePurposeFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NoticePurposePayload>
          }
          findFirst: {
            args: Prisma.NoticePurposeFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NoticePurposePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.NoticePurposeFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NoticePurposePayload>
          }
          findMany: {
            args: Prisma.NoticePurposeFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NoticePurposePayload>[]
          }
          create: {
            args: Prisma.NoticePurposeCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NoticePurposePayload>
          }
          createMany: {
            args: Prisma.NoticePurposeCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.NoticePurposeCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NoticePurposePayload>[]
          }
          delete: {
            args: Prisma.NoticePurposeDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NoticePurposePayload>
          }
          update: {
            args: Prisma.NoticePurposeUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NoticePurposePayload>
          }
          deleteMany: {
            args: Prisma.NoticePurposeDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.NoticePurposeUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.NoticePurposeUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NoticePurposePayload>[]
          }
          upsert: {
            args: Prisma.NoticePurposeUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NoticePurposePayload>
          }
          aggregate: {
            args: Prisma.NoticePurposeAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateNoticePurpose>
          }
          groupBy: {
            args: Prisma.NoticePurposeGroupByArgs<ExtArgs>
            result: $Utils.Optional<NoticePurposeGroupByOutputType>[]
          }
          count: {
            args: Prisma.NoticePurposeCountArgs<ExtArgs>
            result: $Utils.Optional<NoticePurposeCountAggregateOutputType> | number
          }
        }
      }
      ConsentRecord: {
        payload: Prisma.$ConsentRecordPayload<ExtArgs>
        fields: Prisma.ConsentRecordFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ConsentRecordFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConsentRecordPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ConsentRecordFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConsentRecordPayload>
          }
          findFirst: {
            args: Prisma.ConsentRecordFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConsentRecordPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ConsentRecordFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConsentRecordPayload>
          }
          findMany: {
            args: Prisma.ConsentRecordFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConsentRecordPayload>[]
          }
          create: {
            args: Prisma.ConsentRecordCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConsentRecordPayload>
          }
          createMany: {
            args: Prisma.ConsentRecordCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ConsentRecordCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConsentRecordPayload>[]
          }
          delete: {
            args: Prisma.ConsentRecordDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConsentRecordPayload>
          }
          update: {
            args: Prisma.ConsentRecordUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConsentRecordPayload>
          }
          deleteMany: {
            args: Prisma.ConsentRecordDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ConsentRecordUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.ConsentRecordUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConsentRecordPayload>[]
          }
          upsert: {
            args: Prisma.ConsentRecordUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConsentRecordPayload>
          }
          aggregate: {
            args: Prisma.ConsentRecordAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateConsentRecord>
          }
          groupBy: {
            args: Prisma.ConsentRecordGroupByArgs<ExtArgs>
            result: $Utils.Optional<ConsentRecordGroupByOutputType>[]
          }
          count: {
            args: Prisma.ConsentRecordCountArgs<ExtArgs>
            result: $Utils.Optional<ConsentRecordCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     * 
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     * 
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`
     */
    adapter?: runtime.SqlDriverAdapterFactory | null
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
  }
  export type GlobalOmitConfig = {
    organisation?: OrganisationOmit
    website?: WebsiteOmit
    session?: SessionOmit
    event?: EventOmit
    principal?: PrincipalOmit
    purpose?: PurposeOmit
    policy?: PolicyOmit
    policyVersion?: PolicyVersionOmit
    notice?: NoticeOmit
    noticePurpose?: NoticePurposeOmit
    consentRecord?: ConsentRecordOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<
    T extends LogDefinition ? T['level'] : T
  >;

  export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition>
    ? GetLogType<T[number]>
    : never;

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type OrganisationCountOutputType
   */

  export type OrganisationCountOutputType = {
    websites: number
    purposes: number
    policies: number
    notices: number
  }

  export type OrganisationCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    websites?: boolean | OrganisationCountOutputTypeCountWebsitesArgs
    purposes?: boolean | OrganisationCountOutputTypeCountPurposesArgs
    policies?: boolean | OrganisationCountOutputTypeCountPoliciesArgs
    notices?: boolean | OrganisationCountOutputTypeCountNoticesArgs
  }

  // Custom InputTypes
  /**
   * OrganisationCountOutputType without action
   */
  export type OrganisationCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrganisationCountOutputType
     */
    select?: OrganisationCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * OrganisationCountOutputType without action
   */
  export type OrganisationCountOutputTypeCountWebsitesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: WebsiteWhereInput
  }

  /**
   * OrganisationCountOutputType without action
   */
  export type OrganisationCountOutputTypeCountPurposesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PurposeWhereInput
  }

  /**
   * OrganisationCountOutputType without action
   */
  export type OrganisationCountOutputTypeCountPoliciesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PolicyWhereInput
  }

  /**
   * OrganisationCountOutputType without action
   */
  export type OrganisationCountOutputTypeCountNoticesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: NoticeWhereInput
  }


  /**
   * Count Type WebsiteCountOutputType
   */

  export type WebsiteCountOutputType = {
    sessions: number
    events: number
    principals: number
    consentRecords: number
  }

  export type WebsiteCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    sessions?: boolean | WebsiteCountOutputTypeCountSessionsArgs
    events?: boolean | WebsiteCountOutputTypeCountEventsArgs
    principals?: boolean | WebsiteCountOutputTypeCountPrincipalsArgs
    consentRecords?: boolean | WebsiteCountOutputTypeCountConsentRecordsArgs
  }

  // Custom InputTypes
  /**
   * WebsiteCountOutputType without action
   */
  export type WebsiteCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WebsiteCountOutputType
     */
    select?: WebsiteCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * WebsiteCountOutputType without action
   */
  export type WebsiteCountOutputTypeCountSessionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SessionWhereInput
  }

  /**
   * WebsiteCountOutputType without action
   */
  export type WebsiteCountOutputTypeCountEventsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: EventWhereInput
  }

  /**
   * WebsiteCountOutputType without action
   */
  export type WebsiteCountOutputTypeCountPrincipalsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PrincipalWhereInput
  }

  /**
   * WebsiteCountOutputType without action
   */
  export type WebsiteCountOutputTypeCountConsentRecordsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ConsentRecordWhereInput
  }


  /**
   * Count Type SessionCountOutputType
   */

  export type SessionCountOutputType = {
    events: number
  }

  export type SessionCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    events?: boolean | SessionCountOutputTypeCountEventsArgs
  }

  // Custom InputTypes
  /**
   * SessionCountOutputType without action
   */
  export type SessionCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SessionCountOutputType
     */
    select?: SessionCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * SessionCountOutputType without action
   */
  export type SessionCountOutputTypeCountEventsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: EventWhereInput
  }


  /**
   * Count Type PrincipalCountOutputType
   */

  export type PrincipalCountOutputType = {
    consentRecords: number
  }

  export type PrincipalCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    consentRecords?: boolean | PrincipalCountOutputTypeCountConsentRecordsArgs
  }

  // Custom InputTypes
  /**
   * PrincipalCountOutputType without action
   */
  export type PrincipalCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PrincipalCountOutputType
     */
    select?: PrincipalCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * PrincipalCountOutputType without action
   */
  export type PrincipalCountOutputTypeCountConsentRecordsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ConsentRecordWhereInput
  }


  /**
   * Count Type PurposeCountOutputType
   */

  export type PurposeCountOutputType = {
    noticePurposes: number
    consentRecords: number
  }

  export type PurposeCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    noticePurposes?: boolean | PurposeCountOutputTypeCountNoticePurposesArgs
    consentRecords?: boolean | PurposeCountOutputTypeCountConsentRecordsArgs
  }

  // Custom InputTypes
  /**
   * PurposeCountOutputType without action
   */
  export type PurposeCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PurposeCountOutputType
     */
    select?: PurposeCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * PurposeCountOutputType without action
   */
  export type PurposeCountOutputTypeCountNoticePurposesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: NoticePurposeWhereInput
  }

  /**
   * PurposeCountOutputType without action
   */
  export type PurposeCountOutputTypeCountConsentRecordsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ConsentRecordWhereInput
  }


  /**
   * Count Type PolicyCountOutputType
   */

  export type PolicyCountOutputType = {
    versions: number
  }

  export type PolicyCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    versions?: boolean | PolicyCountOutputTypeCountVersionsArgs
  }

  // Custom InputTypes
  /**
   * PolicyCountOutputType without action
   */
  export type PolicyCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PolicyCountOutputType
     */
    select?: PolicyCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * PolicyCountOutputType without action
   */
  export type PolicyCountOutputTypeCountVersionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PolicyVersionWhereInput
  }


  /**
   * Count Type PolicyVersionCountOutputType
   */

  export type PolicyVersionCountOutputType = {
    notices: number
    consentRecords: number
  }

  export type PolicyVersionCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    notices?: boolean | PolicyVersionCountOutputTypeCountNoticesArgs
    consentRecords?: boolean | PolicyVersionCountOutputTypeCountConsentRecordsArgs
  }

  // Custom InputTypes
  /**
   * PolicyVersionCountOutputType without action
   */
  export type PolicyVersionCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PolicyVersionCountOutputType
     */
    select?: PolicyVersionCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * PolicyVersionCountOutputType without action
   */
  export type PolicyVersionCountOutputTypeCountNoticesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: NoticeWhereInput
  }

  /**
   * PolicyVersionCountOutputType without action
   */
  export type PolicyVersionCountOutputTypeCountConsentRecordsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ConsentRecordWhereInput
  }


  /**
   * Count Type NoticeCountOutputType
   */

  export type NoticeCountOutputType = {
    purposes: number
    consentRecords: number
  }

  export type NoticeCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    purposes?: boolean | NoticeCountOutputTypeCountPurposesArgs
    consentRecords?: boolean | NoticeCountOutputTypeCountConsentRecordsArgs
  }

  // Custom InputTypes
  /**
   * NoticeCountOutputType without action
   */
  export type NoticeCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the NoticeCountOutputType
     */
    select?: NoticeCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * NoticeCountOutputType without action
   */
  export type NoticeCountOutputTypeCountPurposesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: NoticePurposeWhereInput
  }

  /**
   * NoticeCountOutputType without action
   */
  export type NoticeCountOutputTypeCountConsentRecordsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ConsentRecordWhereInput
  }


  /**
   * Models
   */

  /**
   * Model Organisation
   */

  export type AggregateOrganisation = {
    _count: OrganisationCountAggregateOutputType | null
    _min: OrganisationMinAggregateOutputType | null
    _max: OrganisationMaxAggregateOutputType | null
  }

  export type OrganisationMinAggregateOutputType = {
    id: string | null
    name: string | null
    slug: string | null
    secretKeyHash: string | null
    createdAt: Date | null
  }

  export type OrganisationMaxAggregateOutputType = {
    id: string | null
    name: string | null
    slug: string | null
    secretKeyHash: string | null
    createdAt: Date | null
  }

  export type OrganisationCountAggregateOutputType = {
    id: number
    name: number
    slug: number
    secretKeyHash: number
    createdAt: number
    _all: number
  }


  export type OrganisationMinAggregateInputType = {
    id?: true
    name?: true
    slug?: true
    secretKeyHash?: true
    createdAt?: true
  }

  export type OrganisationMaxAggregateInputType = {
    id?: true
    name?: true
    slug?: true
    secretKeyHash?: true
    createdAt?: true
  }

  export type OrganisationCountAggregateInputType = {
    id?: true
    name?: true
    slug?: true
    secretKeyHash?: true
    createdAt?: true
    _all?: true
  }

  export type OrganisationAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Organisation to aggregate.
     */
    where?: OrganisationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Organisations to fetch.
     */
    orderBy?: OrganisationOrderByWithRelationInput | OrganisationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: OrganisationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Organisations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Organisations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Organisations
    **/
    _count?: true | OrganisationCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: OrganisationMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: OrganisationMaxAggregateInputType
  }

  export type GetOrganisationAggregateType<T extends OrganisationAggregateArgs> = {
        [P in keyof T & keyof AggregateOrganisation]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateOrganisation[P]>
      : GetScalarType<T[P], AggregateOrganisation[P]>
  }




  export type OrganisationGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: OrganisationWhereInput
    orderBy?: OrganisationOrderByWithAggregationInput | OrganisationOrderByWithAggregationInput[]
    by: OrganisationScalarFieldEnum[] | OrganisationScalarFieldEnum
    having?: OrganisationScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: OrganisationCountAggregateInputType | true
    _min?: OrganisationMinAggregateInputType
    _max?: OrganisationMaxAggregateInputType
  }

  export type OrganisationGroupByOutputType = {
    id: string
    name: string
    slug: string
    secretKeyHash: string
    createdAt: Date
    _count: OrganisationCountAggregateOutputType | null
    _min: OrganisationMinAggregateOutputType | null
    _max: OrganisationMaxAggregateOutputType | null
  }

  type GetOrganisationGroupByPayload<T extends OrganisationGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<OrganisationGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof OrganisationGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], OrganisationGroupByOutputType[P]>
            : GetScalarType<T[P], OrganisationGroupByOutputType[P]>
        }
      >
    >


  export type OrganisationSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    slug?: boolean
    secretKeyHash?: boolean
    createdAt?: boolean
    websites?: boolean | Organisation$websitesArgs<ExtArgs>
    purposes?: boolean | Organisation$purposesArgs<ExtArgs>
    policies?: boolean | Organisation$policiesArgs<ExtArgs>
    notices?: boolean | Organisation$noticesArgs<ExtArgs>
    _count?: boolean | OrganisationCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["organisation"]>

  export type OrganisationSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    slug?: boolean
    secretKeyHash?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["organisation"]>

  export type OrganisationSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    slug?: boolean
    secretKeyHash?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["organisation"]>

  export type OrganisationSelectScalar = {
    id?: boolean
    name?: boolean
    slug?: boolean
    secretKeyHash?: boolean
    createdAt?: boolean
  }

  export type OrganisationOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "slug" | "secretKeyHash" | "createdAt", ExtArgs["result"]["organisation"]>
  export type OrganisationInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    websites?: boolean | Organisation$websitesArgs<ExtArgs>
    purposes?: boolean | Organisation$purposesArgs<ExtArgs>
    policies?: boolean | Organisation$policiesArgs<ExtArgs>
    notices?: boolean | Organisation$noticesArgs<ExtArgs>
    _count?: boolean | OrganisationCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type OrganisationIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type OrganisationIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $OrganisationPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Organisation"
    objects: {
      websites: Prisma.$WebsitePayload<ExtArgs>[]
      purposes: Prisma.$PurposePayload<ExtArgs>[]
      policies: Prisma.$PolicyPayload<ExtArgs>[]
      notices: Prisma.$NoticePayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string
      slug: string
      /**
       * SHA-256 of the server-side secret key (`sk_...`). The plaintext secret is
       * shown once at creation and never stored.
       */
      secretKeyHash: string
      createdAt: Date
    }, ExtArgs["result"]["organisation"]>
    composites: {}
  }

  type OrganisationGetPayload<S extends boolean | null | undefined | OrganisationDefaultArgs> = $Result.GetResult<Prisma.$OrganisationPayload, S>

  type OrganisationCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<OrganisationFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: OrganisationCountAggregateInputType | true
    }

  export interface OrganisationDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Organisation'], meta: { name: 'Organisation' } }
    /**
     * Find zero or one Organisation that matches the filter.
     * @param {OrganisationFindUniqueArgs} args - Arguments to find a Organisation
     * @example
     * // Get one Organisation
     * const organisation = await prisma.organisation.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends OrganisationFindUniqueArgs>(args: SelectSubset<T, OrganisationFindUniqueArgs<ExtArgs>>): Prisma__OrganisationClient<$Result.GetResult<Prisma.$OrganisationPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Organisation that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {OrganisationFindUniqueOrThrowArgs} args - Arguments to find a Organisation
     * @example
     * // Get one Organisation
     * const organisation = await prisma.organisation.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends OrganisationFindUniqueOrThrowArgs>(args: SelectSubset<T, OrganisationFindUniqueOrThrowArgs<ExtArgs>>): Prisma__OrganisationClient<$Result.GetResult<Prisma.$OrganisationPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Organisation that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrganisationFindFirstArgs} args - Arguments to find a Organisation
     * @example
     * // Get one Organisation
     * const organisation = await prisma.organisation.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends OrganisationFindFirstArgs>(args?: SelectSubset<T, OrganisationFindFirstArgs<ExtArgs>>): Prisma__OrganisationClient<$Result.GetResult<Prisma.$OrganisationPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Organisation that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrganisationFindFirstOrThrowArgs} args - Arguments to find a Organisation
     * @example
     * // Get one Organisation
     * const organisation = await prisma.organisation.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends OrganisationFindFirstOrThrowArgs>(args?: SelectSubset<T, OrganisationFindFirstOrThrowArgs<ExtArgs>>): Prisma__OrganisationClient<$Result.GetResult<Prisma.$OrganisationPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Organisations that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrganisationFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Organisations
     * const organisations = await prisma.organisation.findMany()
     * 
     * // Get first 10 Organisations
     * const organisations = await prisma.organisation.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const organisationWithIdOnly = await prisma.organisation.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends OrganisationFindManyArgs>(args?: SelectSubset<T, OrganisationFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$OrganisationPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Organisation.
     * @param {OrganisationCreateArgs} args - Arguments to create a Organisation.
     * @example
     * // Create one Organisation
     * const Organisation = await prisma.organisation.create({
     *   data: {
     *     // ... data to create a Organisation
     *   }
     * })
     * 
     */
    create<T extends OrganisationCreateArgs>(args: SelectSubset<T, OrganisationCreateArgs<ExtArgs>>): Prisma__OrganisationClient<$Result.GetResult<Prisma.$OrganisationPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Organisations.
     * @param {OrganisationCreateManyArgs} args - Arguments to create many Organisations.
     * @example
     * // Create many Organisations
     * const organisation = await prisma.organisation.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends OrganisationCreateManyArgs>(args?: SelectSubset<T, OrganisationCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Organisations and returns the data saved in the database.
     * @param {OrganisationCreateManyAndReturnArgs} args - Arguments to create many Organisations.
     * @example
     * // Create many Organisations
     * const organisation = await prisma.organisation.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Organisations and only return the `id`
     * const organisationWithIdOnly = await prisma.organisation.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends OrganisationCreateManyAndReturnArgs>(args?: SelectSubset<T, OrganisationCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$OrganisationPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Organisation.
     * @param {OrganisationDeleteArgs} args - Arguments to delete one Organisation.
     * @example
     * // Delete one Organisation
     * const Organisation = await prisma.organisation.delete({
     *   where: {
     *     // ... filter to delete one Organisation
     *   }
     * })
     * 
     */
    delete<T extends OrganisationDeleteArgs>(args: SelectSubset<T, OrganisationDeleteArgs<ExtArgs>>): Prisma__OrganisationClient<$Result.GetResult<Prisma.$OrganisationPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Organisation.
     * @param {OrganisationUpdateArgs} args - Arguments to update one Organisation.
     * @example
     * // Update one Organisation
     * const organisation = await prisma.organisation.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends OrganisationUpdateArgs>(args: SelectSubset<T, OrganisationUpdateArgs<ExtArgs>>): Prisma__OrganisationClient<$Result.GetResult<Prisma.$OrganisationPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Organisations.
     * @param {OrganisationDeleteManyArgs} args - Arguments to filter Organisations to delete.
     * @example
     * // Delete a few Organisations
     * const { count } = await prisma.organisation.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends OrganisationDeleteManyArgs>(args?: SelectSubset<T, OrganisationDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Organisations.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrganisationUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Organisations
     * const organisation = await prisma.organisation.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends OrganisationUpdateManyArgs>(args: SelectSubset<T, OrganisationUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Organisations and returns the data updated in the database.
     * @param {OrganisationUpdateManyAndReturnArgs} args - Arguments to update many Organisations.
     * @example
     * // Update many Organisations
     * const organisation = await prisma.organisation.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Organisations and only return the `id`
     * const organisationWithIdOnly = await prisma.organisation.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends OrganisationUpdateManyAndReturnArgs>(args: SelectSubset<T, OrganisationUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$OrganisationPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Organisation.
     * @param {OrganisationUpsertArgs} args - Arguments to update or create a Organisation.
     * @example
     * // Update or create a Organisation
     * const organisation = await prisma.organisation.upsert({
     *   create: {
     *     // ... data to create a Organisation
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Organisation we want to update
     *   }
     * })
     */
    upsert<T extends OrganisationUpsertArgs>(args: SelectSubset<T, OrganisationUpsertArgs<ExtArgs>>): Prisma__OrganisationClient<$Result.GetResult<Prisma.$OrganisationPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Organisations.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrganisationCountArgs} args - Arguments to filter Organisations to count.
     * @example
     * // Count the number of Organisations
     * const count = await prisma.organisation.count({
     *   where: {
     *     // ... the filter for the Organisations we want to count
     *   }
     * })
    **/
    count<T extends OrganisationCountArgs>(
      args?: Subset<T, OrganisationCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], OrganisationCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Organisation.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrganisationAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends OrganisationAggregateArgs>(args: Subset<T, OrganisationAggregateArgs>): Prisma.PrismaPromise<GetOrganisationAggregateType<T>>

    /**
     * Group by Organisation.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrganisationGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends OrganisationGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: OrganisationGroupByArgs['orderBy'] }
        : { orderBy?: OrganisationGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, OrganisationGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetOrganisationGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Organisation model
   */
  readonly fields: OrganisationFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Organisation.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__OrganisationClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    websites<T extends Organisation$websitesArgs<ExtArgs> = {}>(args?: Subset<T, Organisation$websitesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$WebsitePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    purposes<T extends Organisation$purposesArgs<ExtArgs> = {}>(args?: Subset<T, Organisation$purposesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PurposePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    policies<T extends Organisation$policiesArgs<ExtArgs> = {}>(args?: Subset<T, Organisation$policiesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PolicyPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    notices<T extends Organisation$noticesArgs<ExtArgs> = {}>(args?: Subset<T, Organisation$noticesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$NoticePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Organisation model
   */
  interface OrganisationFieldRefs {
    readonly id: FieldRef<"Organisation", 'String'>
    readonly name: FieldRef<"Organisation", 'String'>
    readonly slug: FieldRef<"Organisation", 'String'>
    readonly secretKeyHash: FieldRef<"Organisation", 'String'>
    readonly createdAt: FieldRef<"Organisation", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Organisation findUnique
   */
  export type OrganisationFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Organisation
     */
    select?: OrganisationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Organisation
     */
    omit?: OrganisationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganisationInclude<ExtArgs> | null
    /**
     * Filter, which Organisation to fetch.
     */
    where: OrganisationWhereUniqueInput
  }

  /**
   * Organisation findUniqueOrThrow
   */
  export type OrganisationFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Organisation
     */
    select?: OrganisationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Organisation
     */
    omit?: OrganisationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganisationInclude<ExtArgs> | null
    /**
     * Filter, which Organisation to fetch.
     */
    where: OrganisationWhereUniqueInput
  }

  /**
   * Organisation findFirst
   */
  export type OrganisationFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Organisation
     */
    select?: OrganisationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Organisation
     */
    omit?: OrganisationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganisationInclude<ExtArgs> | null
    /**
     * Filter, which Organisation to fetch.
     */
    where?: OrganisationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Organisations to fetch.
     */
    orderBy?: OrganisationOrderByWithRelationInput | OrganisationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Organisations.
     */
    cursor?: OrganisationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Organisations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Organisations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Organisations.
     */
    distinct?: OrganisationScalarFieldEnum | OrganisationScalarFieldEnum[]
  }

  /**
   * Organisation findFirstOrThrow
   */
  export type OrganisationFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Organisation
     */
    select?: OrganisationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Organisation
     */
    omit?: OrganisationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganisationInclude<ExtArgs> | null
    /**
     * Filter, which Organisation to fetch.
     */
    where?: OrganisationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Organisations to fetch.
     */
    orderBy?: OrganisationOrderByWithRelationInput | OrganisationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Organisations.
     */
    cursor?: OrganisationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Organisations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Organisations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Organisations.
     */
    distinct?: OrganisationScalarFieldEnum | OrganisationScalarFieldEnum[]
  }

  /**
   * Organisation findMany
   */
  export type OrganisationFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Organisation
     */
    select?: OrganisationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Organisation
     */
    omit?: OrganisationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganisationInclude<ExtArgs> | null
    /**
     * Filter, which Organisations to fetch.
     */
    where?: OrganisationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Organisations to fetch.
     */
    orderBy?: OrganisationOrderByWithRelationInput | OrganisationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Organisations.
     */
    cursor?: OrganisationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Organisations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Organisations.
     */
    skip?: number
    distinct?: OrganisationScalarFieldEnum | OrganisationScalarFieldEnum[]
  }

  /**
   * Organisation create
   */
  export type OrganisationCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Organisation
     */
    select?: OrganisationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Organisation
     */
    omit?: OrganisationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganisationInclude<ExtArgs> | null
    /**
     * The data needed to create a Organisation.
     */
    data: XOR<OrganisationCreateInput, OrganisationUncheckedCreateInput>
  }

  /**
   * Organisation createMany
   */
  export type OrganisationCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Organisations.
     */
    data: OrganisationCreateManyInput | OrganisationCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Organisation createManyAndReturn
   */
  export type OrganisationCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Organisation
     */
    select?: OrganisationSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Organisation
     */
    omit?: OrganisationOmit<ExtArgs> | null
    /**
     * The data used to create many Organisations.
     */
    data: OrganisationCreateManyInput | OrganisationCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Organisation update
   */
  export type OrganisationUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Organisation
     */
    select?: OrganisationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Organisation
     */
    omit?: OrganisationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganisationInclude<ExtArgs> | null
    /**
     * The data needed to update a Organisation.
     */
    data: XOR<OrganisationUpdateInput, OrganisationUncheckedUpdateInput>
    /**
     * Choose, which Organisation to update.
     */
    where: OrganisationWhereUniqueInput
  }

  /**
   * Organisation updateMany
   */
  export type OrganisationUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Organisations.
     */
    data: XOR<OrganisationUpdateManyMutationInput, OrganisationUncheckedUpdateManyInput>
    /**
     * Filter which Organisations to update
     */
    where?: OrganisationWhereInput
    /**
     * Limit how many Organisations to update.
     */
    limit?: number
  }

  /**
   * Organisation updateManyAndReturn
   */
  export type OrganisationUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Organisation
     */
    select?: OrganisationSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Organisation
     */
    omit?: OrganisationOmit<ExtArgs> | null
    /**
     * The data used to update Organisations.
     */
    data: XOR<OrganisationUpdateManyMutationInput, OrganisationUncheckedUpdateManyInput>
    /**
     * Filter which Organisations to update
     */
    where?: OrganisationWhereInput
    /**
     * Limit how many Organisations to update.
     */
    limit?: number
  }

  /**
   * Organisation upsert
   */
  export type OrganisationUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Organisation
     */
    select?: OrganisationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Organisation
     */
    omit?: OrganisationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganisationInclude<ExtArgs> | null
    /**
     * The filter to search for the Organisation to update in case it exists.
     */
    where: OrganisationWhereUniqueInput
    /**
     * In case the Organisation found by the `where` argument doesn't exist, create a new Organisation with this data.
     */
    create: XOR<OrganisationCreateInput, OrganisationUncheckedCreateInput>
    /**
     * In case the Organisation was found with the provided `where` argument, update it with this data.
     */
    update: XOR<OrganisationUpdateInput, OrganisationUncheckedUpdateInput>
  }

  /**
   * Organisation delete
   */
  export type OrganisationDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Organisation
     */
    select?: OrganisationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Organisation
     */
    omit?: OrganisationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganisationInclude<ExtArgs> | null
    /**
     * Filter which Organisation to delete.
     */
    where: OrganisationWhereUniqueInput
  }

  /**
   * Organisation deleteMany
   */
  export type OrganisationDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Organisations to delete
     */
    where?: OrganisationWhereInput
    /**
     * Limit how many Organisations to delete.
     */
    limit?: number
  }

  /**
   * Organisation.websites
   */
  export type Organisation$websitesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Website
     */
    select?: WebsiteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Website
     */
    omit?: WebsiteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WebsiteInclude<ExtArgs> | null
    where?: WebsiteWhereInput
    orderBy?: WebsiteOrderByWithRelationInput | WebsiteOrderByWithRelationInput[]
    cursor?: WebsiteWhereUniqueInput
    take?: number
    skip?: number
    distinct?: WebsiteScalarFieldEnum | WebsiteScalarFieldEnum[]
  }

  /**
   * Organisation.purposes
   */
  export type Organisation$purposesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Purpose
     */
    select?: PurposeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Purpose
     */
    omit?: PurposeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PurposeInclude<ExtArgs> | null
    where?: PurposeWhereInput
    orderBy?: PurposeOrderByWithRelationInput | PurposeOrderByWithRelationInput[]
    cursor?: PurposeWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PurposeScalarFieldEnum | PurposeScalarFieldEnum[]
  }

  /**
   * Organisation.policies
   */
  export type Organisation$policiesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Policy
     */
    select?: PolicySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Policy
     */
    omit?: PolicyOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PolicyInclude<ExtArgs> | null
    where?: PolicyWhereInput
    orderBy?: PolicyOrderByWithRelationInput | PolicyOrderByWithRelationInput[]
    cursor?: PolicyWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PolicyScalarFieldEnum | PolicyScalarFieldEnum[]
  }

  /**
   * Organisation.notices
   */
  export type Organisation$noticesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Notice
     */
    select?: NoticeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Notice
     */
    omit?: NoticeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: NoticeInclude<ExtArgs> | null
    where?: NoticeWhereInput
    orderBy?: NoticeOrderByWithRelationInput | NoticeOrderByWithRelationInput[]
    cursor?: NoticeWhereUniqueInput
    take?: number
    skip?: number
    distinct?: NoticeScalarFieldEnum | NoticeScalarFieldEnum[]
  }

  /**
   * Organisation without action
   */
  export type OrganisationDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Organisation
     */
    select?: OrganisationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Organisation
     */
    omit?: OrganisationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganisationInclude<ExtArgs> | null
  }


  /**
   * Model Website
   */

  export type AggregateWebsite = {
    _count: WebsiteCountAggregateOutputType | null
    _min: WebsiteMinAggregateOutputType | null
    _max: WebsiteMaxAggregateOutputType | null
  }

  export type WebsiteMinAggregateOutputType = {
    id: string | null
    organisationId: string | null
    name: string | null
    domain: string | null
    publicKey: string | null
    isActive: boolean | null
    createdAt: Date | null
  }

  export type WebsiteMaxAggregateOutputType = {
    id: string | null
    organisationId: string | null
    name: string | null
    domain: string | null
    publicKey: string | null
    isActive: boolean | null
    createdAt: Date | null
  }

  export type WebsiteCountAggregateOutputType = {
    id: number
    organisationId: number
    name: number
    domain: number
    publicKey: number
    isActive: number
    createdAt: number
    _all: number
  }


  export type WebsiteMinAggregateInputType = {
    id?: true
    organisationId?: true
    name?: true
    domain?: true
    publicKey?: true
    isActive?: true
    createdAt?: true
  }

  export type WebsiteMaxAggregateInputType = {
    id?: true
    organisationId?: true
    name?: true
    domain?: true
    publicKey?: true
    isActive?: true
    createdAt?: true
  }

  export type WebsiteCountAggregateInputType = {
    id?: true
    organisationId?: true
    name?: true
    domain?: true
    publicKey?: true
    isActive?: true
    createdAt?: true
    _all?: true
  }

  export type WebsiteAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Website to aggregate.
     */
    where?: WebsiteWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Websites to fetch.
     */
    orderBy?: WebsiteOrderByWithRelationInput | WebsiteOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: WebsiteWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Websites from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Websites.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Websites
    **/
    _count?: true | WebsiteCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: WebsiteMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: WebsiteMaxAggregateInputType
  }

  export type GetWebsiteAggregateType<T extends WebsiteAggregateArgs> = {
        [P in keyof T & keyof AggregateWebsite]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateWebsite[P]>
      : GetScalarType<T[P], AggregateWebsite[P]>
  }




  export type WebsiteGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: WebsiteWhereInput
    orderBy?: WebsiteOrderByWithAggregationInput | WebsiteOrderByWithAggregationInput[]
    by: WebsiteScalarFieldEnum[] | WebsiteScalarFieldEnum
    having?: WebsiteScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: WebsiteCountAggregateInputType | true
    _min?: WebsiteMinAggregateInputType
    _max?: WebsiteMaxAggregateInputType
  }

  export type WebsiteGroupByOutputType = {
    id: string
    organisationId: string
    name: string
    domain: string
    publicKey: string
    isActive: boolean
    createdAt: Date
    _count: WebsiteCountAggregateOutputType | null
    _min: WebsiteMinAggregateOutputType | null
    _max: WebsiteMaxAggregateOutputType | null
  }

  type GetWebsiteGroupByPayload<T extends WebsiteGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<WebsiteGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof WebsiteGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], WebsiteGroupByOutputType[P]>
            : GetScalarType<T[P], WebsiteGroupByOutputType[P]>
        }
      >
    >


  export type WebsiteSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organisationId?: boolean
    name?: boolean
    domain?: boolean
    publicKey?: boolean
    isActive?: boolean
    createdAt?: boolean
    organisation?: boolean | OrganisationDefaultArgs<ExtArgs>
    sessions?: boolean | Website$sessionsArgs<ExtArgs>
    events?: boolean | Website$eventsArgs<ExtArgs>
    principals?: boolean | Website$principalsArgs<ExtArgs>
    consentRecords?: boolean | Website$consentRecordsArgs<ExtArgs>
    _count?: boolean | WebsiteCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["website"]>

  export type WebsiteSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organisationId?: boolean
    name?: boolean
    domain?: boolean
    publicKey?: boolean
    isActive?: boolean
    createdAt?: boolean
    organisation?: boolean | OrganisationDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["website"]>

  export type WebsiteSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organisationId?: boolean
    name?: boolean
    domain?: boolean
    publicKey?: boolean
    isActive?: boolean
    createdAt?: boolean
    organisation?: boolean | OrganisationDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["website"]>

  export type WebsiteSelectScalar = {
    id?: boolean
    organisationId?: boolean
    name?: boolean
    domain?: boolean
    publicKey?: boolean
    isActive?: boolean
    createdAt?: boolean
  }

  export type WebsiteOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "organisationId" | "name" | "domain" | "publicKey" | "isActive" | "createdAt", ExtArgs["result"]["website"]>
  export type WebsiteInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    organisation?: boolean | OrganisationDefaultArgs<ExtArgs>
    sessions?: boolean | Website$sessionsArgs<ExtArgs>
    events?: boolean | Website$eventsArgs<ExtArgs>
    principals?: boolean | Website$principalsArgs<ExtArgs>
    consentRecords?: boolean | Website$consentRecordsArgs<ExtArgs>
    _count?: boolean | WebsiteCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type WebsiteIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    organisation?: boolean | OrganisationDefaultArgs<ExtArgs>
  }
  export type WebsiteIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    organisation?: boolean | OrganisationDefaultArgs<ExtArgs>
  }

  export type $WebsitePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Website"
    objects: {
      organisation: Prisma.$OrganisationPayload<ExtArgs>
      sessions: Prisma.$SessionPayload<ExtArgs>[]
      events: Prisma.$EventPayload<ExtArgs>[]
      principals: Prisma.$PrincipalPayload<ExtArgs>[]
      consentRecords: Prisma.$ConsentRecordPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      organisationId: string
      name: string
      domain: string
      /**
       * Public client identifier (`pk_...`). Safe to embed in browser code; it
       * authorises ingestion for this one site and nothing else.
       */
      publicKey: string
      isActive: boolean
      createdAt: Date
    }, ExtArgs["result"]["website"]>
    composites: {}
  }

  type WebsiteGetPayload<S extends boolean | null | undefined | WebsiteDefaultArgs> = $Result.GetResult<Prisma.$WebsitePayload, S>

  type WebsiteCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<WebsiteFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: WebsiteCountAggregateInputType | true
    }

  export interface WebsiteDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Website'], meta: { name: 'Website' } }
    /**
     * Find zero or one Website that matches the filter.
     * @param {WebsiteFindUniqueArgs} args - Arguments to find a Website
     * @example
     * // Get one Website
     * const website = await prisma.website.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends WebsiteFindUniqueArgs>(args: SelectSubset<T, WebsiteFindUniqueArgs<ExtArgs>>): Prisma__WebsiteClient<$Result.GetResult<Prisma.$WebsitePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Website that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {WebsiteFindUniqueOrThrowArgs} args - Arguments to find a Website
     * @example
     * // Get one Website
     * const website = await prisma.website.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends WebsiteFindUniqueOrThrowArgs>(args: SelectSubset<T, WebsiteFindUniqueOrThrowArgs<ExtArgs>>): Prisma__WebsiteClient<$Result.GetResult<Prisma.$WebsitePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Website that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WebsiteFindFirstArgs} args - Arguments to find a Website
     * @example
     * // Get one Website
     * const website = await prisma.website.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends WebsiteFindFirstArgs>(args?: SelectSubset<T, WebsiteFindFirstArgs<ExtArgs>>): Prisma__WebsiteClient<$Result.GetResult<Prisma.$WebsitePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Website that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WebsiteFindFirstOrThrowArgs} args - Arguments to find a Website
     * @example
     * // Get one Website
     * const website = await prisma.website.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends WebsiteFindFirstOrThrowArgs>(args?: SelectSubset<T, WebsiteFindFirstOrThrowArgs<ExtArgs>>): Prisma__WebsiteClient<$Result.GetResult<Prisma.$WebsitePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Websites that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WebsiteFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Websites
     * const websites = await prisma.website.findMany()
     * 
     * // Get first 10 Websites
     * const websites = await prisma.website.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const websiteWithIdOnly = await prisma.website.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends WebsiteFindManyArgs>(args?: SelectSubset<T, WebsiteFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$WebsitePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Website.
     * @param {WebsiteCreateArgs} args - Arguments to create a Website.
     * @example
     * // Create one Website
     * const Website = await prisma.website.create({
     *   data: {
     *     // ... data to create a Website
     *   }
     * })
     * 
     */
    create<T extends WebsiteCreateArgs>(args: SelectSubset<T, WebsiteCreateArgs<ExtArgs>>): Prisma__WebsiteClient<$Result.GetResult<Prisma.$WebsitePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Websites.
     * @param {WebsiteCreateManyArgs} args - Arguments to create many Websites.
     * @example
     * // Create many Websites
     * const website = await prisma.website.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends WebsiteCreateManyArgs>(args?: SelectSubset<T, WebsiteCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Websites and returns the data saved in the database.
     * @param {WebsiteCreateManyAndReturnArgs} args - Arguments to create many Websites.
     * @example
     * // Create many Websites
     * const website = await prisma.website.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Websites and only return the `id`
     * const websiteWithIdOnly = await prisma.website.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends WebsiteCreateManyAndReturnArgs>(args?: SelectSubset<T, WebsiteCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$WebsitePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Website.
     * @param {WebsiteDeleteArgs} args - Arguments to delete one Website.
     * @example
     * // Delete one Website
     * const Website = await prisma.website.delete({
     *   where: {
     *     // ... filter to delete one Website
     *   }
     * })
     * 
     */
    delete<T extends WebsiteDeleteArgs>(args: SelectSubset<T, WebsiteDeleteArgs<ExtArgs>>): Prisma__WebsiteClient<$Result.GetResult<Prisma.$WebsitePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Website.
     * @param {WebsiteUpdateArgs} args - Arguments to update one Website.
     * @example
     * // Update one Website
     * const website = await prisma.website.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends WebsiteUpdateArgs>(args: SelectSubset<T, WebsiteUpdateArgs<ExtArgs>>): Prisma__WebsiteClient<$Result.GetResult<Prisma.$WebsitePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Websites.
     * @param {WebsiteDeleteManyArgs} args - Arguments to filter Websites to delete.
     * @example
     * // Delete a few Websites
     * const { count } = await prisma.website.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends WebsiteDeleteManyArgs>(args?: SelectSubset<T, WebsiteDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Websites.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WebsiteUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Websites
     * const website = await prisma.website.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends WebsiteUpdateManyArgs>(args: SelectSubset<T, WebsiteUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Websites and returns the data updated in the database.
     * @param {WebsiteUpdateManyAndReturnArgs} args - Arguments to update many Websites.
     * @example
     * // Update many Websites
     * const website = await prisma.website.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Websites and only return the `id`
     * const websiteWithIdOnly = await prisma.website.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends WebsiteUpdateManyAndReturnArgs>(args: SelectSubset<T, WebsiteUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$WebsitePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Website.
     * @param {WebsiteUpsertArgs} args - Arguments to update or create a Website.
     * @example
     * // Update or create a Website
     * const website = await prisma.website.upsert({
     *   create: {
     *     // ... data to create a Website
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Website we want to update
     *   }
     * })
     */
    upsert<T extends WebsiteUpsertArgs>(args: SelectSubset<T, WebsiteUpsertArgs<ExtArgs>>): Prisma__WebsiteClient<$Result.GetResult<Prisma.$WebsitePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Websites.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WebsiteCountArgs} args - Arguments to filter Websites to count.
     * @example
     * // Count the number of Websites
     * const count = await prisma.website.count({
     *   where: {
     *     // ... the filter for the Websites we want to count
     *   }
     * })
    **/
    count<T extends WebsiteCountArgs>(
      args?: Subset<T, WebsiteCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], WebsiteCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Website.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WebsiteAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends WebsiteAggregateArgs>(args: Subset<T, WebsiteAggregateArgs>): Prisma.PrismaPromise<GetWebsiteAggregateType<T>>

    /**
     * Group by Website.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WebsiteGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends WebsiteGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: WebsiteGroupByArgs['orderBy'] }
        : { orderBy?: WebsiteGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, WebsiteGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetWebsiteGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Website model
   */
  readonly fields: WebsiteFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Website.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__WebsiteClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    organisation<T extends OrganisationDefaultArgs<ExtArgs> = {}>(args?: Subset<T, OrganisationDefaultArgs<ExtArgs>>): Prisma__OrganisationClient<$Result.GetResult<Prisma.$OrganisationPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    sessions<T extends Website$sessionsArgs<ExtArgs> = {}>(args?: Subset<T, Website$sessionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    events<T extends Website$eventsArgs<ExtArgs> = {}>(args?: Subset<T, Website$eventsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EventPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    principals<T extends Website$principalsArgs<ExtArgs> = {}>(args?: Subset<T, Website$principalsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PrincipalPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    consentRecords<T extends Website$consentRecordsArgs<ExtArgs> = {}>(args?: Subset<T, Website$consentRecordsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ConsentRecordPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Website model
   */
  interface WebsiteFieldRefs {
    readonly id: FieldRef<"Website", 'String'>
    readonly organisationId: FieldRef<"Website", 'String'>
    readonly name: FieldRef<"Website", 'String'>
    readonly domain: FieldRef<"Website", 'String'>
    readonly publicKey: FieldRef<"Website", 'String'>
    readonly isActive: FieldRef<"Website", 'Boolean'>
    readonly createdAt: FieldRef<"Website", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Website findUnique
   */
  export type WebsiteFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Website
     */
    select?: WebsiteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Website
     */
    omit?: WebsiteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WebsiteInclude<ExtArgs> | null
    /**
     * Filter, which Website to fetch.
     */
    where: WebsiteWhereUniqueInput
  }

  /**
   * Website findUniqueOrThrow
   */
  export type WebsiteFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Website
     */
    select?: WebsiteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Website
     */
    omit?: WebsiteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WebsiteInclude<ExtArgs> | null
    /**
     * Filter, which Website to fetch.
     */
    where: WebsiteWhereUniqueInput
  }

  /**
   * Website findFirst
   */
  export type WebsiteFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Website
     */
    select?: WebsiteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Website
     */
    omit?: WebsiteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WebsiteInclude<ExtArgs> | null
    /**
     * Filter, which Website to fetch.
     */
    where?: WebsiteWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Websites to fetch.
     */
    orderBy?: WebsiteOrderByWithRelationInput | WebsiteOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Websites.
     */
    cursor?: WebsiteWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Websites from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Websites.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Websites.
     */
    distinct?: WebsiteScalarFieldEnum | WebsiteScalarFieldEnum[]
  }

  /**
   * Website findFirstOrThrow
   */
  export type WebsiteFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Website
     */
    select?: WebsiteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Website
     */
    omit?: WebsiteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WebsiteInclude<ExtArgs> | null
    /**
     * Filter, which Website to fetch.
     */
    where?: WebsiteWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Websites to fetch.
     */
    orderBy?: WebsiteOrderByWithRelationInput | WebsiteOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Websites.
     */
    cursor?: WebsiteWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Websites from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Websites.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Websites.
     */
    distinct?: WebsiteScalarFieldEnum | WebsiteScalarFieldEnum[]
  }

  /**
   * Website findMany
   */
  export type WebsiteFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Website
     */
    select?: WebsiteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Website
     */
    omit?: WebsiteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WebsiteInclude<ExtArgs> | null
    /**
     * Filter, which Websites to fetch.
     */
    where?: WebsiteWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Websites to fetch.
     */
    orderBy?: WebsiteOrderByWithRelationInput | WebsiteOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Websites.
     */
    cursor?: WebsiteWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Websites from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Websites.
     */
    skip?: number
    distinct?: WebsiteScalarFieldEnum | WebsiteScalarFieldEnum[]
  }

  /**
   * Website create
   */
  export type WebsiteCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Website
     */
    select?: WebsiteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Website
     */
    omit?: WebsiteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WebsiteInclude<ExtArgs> | null
    /**
     * The data needed to create a Website.
     */
    data: XOR<WebsiteCreateInput, WebsiteUncheckedCreateInput>
  }

  /**
   * Website createMany
   */
  export type WebsiteCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Websites.
     */
    data: WebsiteCreateManyInput | WebsiteCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Website createManyAndReturn
   */
  export type WebsiteCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Website
     */
    select?: WebsiteSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Website
     */
    omit?: WebsiteOmit<ExtArgs> | null
    /**
     * The data used to create many Websites.
     */
    data: WebsiteCreateManyInput | WebsiteCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WebsiteIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Website update
   */
  export type WebsiteUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Website
     */
    select?: WebsiteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Website
     */
    omit?: WebsiteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WebsiteInclude<ExtArgs> | null
    /**
     * The data needed to update a Website.
     */
    data: XOR<WebsiteUpdateInput, WebsiteUncheckedUpdateInput>
    /**
     * Choose, which Website to update.
     */
    where: WebsiteWhereUniqueInput
  }

  /**
   * Website updateMany
   */
  export type WebsiteUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Websites.
     */
    data: XOR<WebsiteUpdateManyMutationInput, WebsiteUncheckedUpdateManyInput>
    /**
     * Filter which Websites to update
     */
    where?: WebsiteWhereInput
    /**
     * Limit how many Websites to update.
     */
    limit?: number
  }

  /**
   * Website updateManyAndReturn
   */
  export type WebsiteUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Website
     */
    select?: WebsiteSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Website
     */
    omit?: WebsiteOmit<ExtArgs> | null
    /**
     * The data used to update Websites.
     */
    data: XOR<WebsiteUpdateManyMutationInput, WebsiteUncheckedUpdateManyInput>
    /**
     * Filter which Websites to update
     */
    where?: WebsiteWhereInput
    /**
     * Limit how many Websites to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WebsiteIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Website upsert
   */
  export type WebsiteUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Website
     */
    select?: WebsiteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Website
     */
    omit?: WebsiteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WebsiteInclude<ExtArgs> | null
    /**
     * The filter to search for the Website to update in case it exists.
     */
    where: WebsiteWhereUniqueInput
    /**
     * In case the Website found by the `where` argument doesn't exist, create a new Website with this data.
     */
    create: XOR<WebsiteCreateInput, WebsiteUncheckedCreateInput>
    /**
     * In case the Website was found with the provided `where` argument, update it with this data.
     */
    update: XOR<WebsiteUpdateInput, WebsiteUncheckedUpdateInput>
  }

  /**
   * Website delete
   */
  export type WebsiteDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Website
     */
    select?: WebsiteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Website
     */
    omit?: WebsiteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WebsiteInclude<ExtArgs> | null
    /**
     * Filter which Website to delete.
     */
    where: WebsiteWhereUniqueInput
  }

  /**
   * Website deleteMany
   */
  export type WebsiteDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Websites to delete
     */
    where?: WebsiteWhereInput
    /**
     * Limit how many Websites to delete.
     */
    limit?: number
  }

  /**
   * Website.sessions
   */
  export type Website$sessionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    where?: SessionWhereInput
    orderBy?: SessionOrderByWithRelationInput | SessionOrderByWithRelationInput[]
    cursor?: SessionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: SessionScalarFieldEnum | SessionScalarFieldEnum[]
  }

  /**
   * Website.events
   */
  export type Website$eventsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Event
     */
    select?: EventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Event
     */
    omit?: EventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EventInclude<ExtArgs> | null
    where?: EventWhereInput
    orderBy?: EventOrderByWithRelationInput | EventOrderByWithRelationInput[]
    cursor?: EventWhereUniqueInput
    take?: number
    skip?: number
    distinct?: EventScalarFieldEnum | EventScalarFieldEnum[]
  }

  /**
   * Website.principals
   */
  export type Website$principalsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Principal
     */
    select?: PrincipalSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Principal
     */
    omit?: PrincipalOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PrincipalInclude<ExtArgs> | null
    where?: PrincipalWhereInput
    orderBy?: PrincipalOrderByWithRelationInput | PrincipalOrderByWithRelationInput[]
    cursor?: PrincipalWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PrincipalScalarFieldEnum | PrincipalScalarFieldEnum[]
  }

  /**
   * Website.consentRecords
   */
  export type Website$consentRecordsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConsentRecord
     */
    select?: ConsentRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ConsentRecord
     */
    omit?: ConsentRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConsentRecordInclude<ExtArgs> | null
    where?: ConsentRecordWhereInput
    orderBy?: ConsentRecordOrderByWithRelationInput | ConsentRecordOrderByWithRelationInput[]
    cursor?: ConsentRecordWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ConsentRecordScalarFieldEnum | ConsentRecordScalarFieldEnum[]
  }

  /**
   * Website without action
   */
  export type WebsiteDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Website
     */
    select?: WebsiteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Website
     */
    omit?: WebsiteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WebsiteInclude<ExtArgs> | null
  }


  /**
   * Model Session
   */

  export type AggregateSession = {
    _count: SessionCountAggregateOutputType | null
    _min: SessionMinAggregateOutputType | null
    _max: SessionMaxAggregateOutputType | null
  }

  export type SessionMinAggregateOutputType = {
    id: string | null
    siteId: string | null
    startedAt: Date | null
    lastActivity: Date | null
  }

  export type SessionMaxAggregateOutputType = {
    id: string | null
    siteId: string | null
    startedAt: Date | null
    lastActivity: Date | null
  }

  export type SessionCountAggregateOutputType = {
    id: number
    siteId: number
    startedAt: number
    lastActivity: number
    _all: number
  }


  export type SessionMinAggregateInputType = {
    id?: true
    siteId?: true
    startedAt?: true
    lastActivity?: true
  }

  export type SessionMaxAggregateInputType = {
    id?: true
    siteId?: true
    startedAt?: true
    lastActivity?: true
  }

  export type SessionCountAggregateInputType = {
    id?: true
    siteId?: true
    startedAt?: true
    lastActivity?: true
    _all?: true
  }

  export type SessionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Session to aggregate.
     */
    where?: SessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Sessions to fetch.
     */
    orderBy?: SessionOrderByWithRelationInput | SessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: SessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Sessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Sessions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Sessions
    **/
    _count?: true | SessionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: SessionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: SessionMaxAggregateInputType
  }

  export type GetSessionAggregateType<T extends SessionAggregateArgs> = {
        [P in keyof T & keyof AggregateSession]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateSession[P]>
      : GetScalarType<T[P], AggregateSession[P]>
  }




  export type SessionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SessionWhereInput
    orderBy?: SessionOrderByWithAggregationInput | SessionOrderByWithAggregationInput[]
    by: SessionScalarFieldEnum[] | SessionScalarFieldEnum
    having?: SessionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: SessionCountAggregateInputType | true
    _min?: SessionMinAggregateInputType
    _max?: SessionMaxAggregateInputType
  }

  export type SessionGroupByOutputType = {
    id: string
    siteId: string
    startedAt: Date
    lastActivity: Date
    _count: SessionCountAggregateOutputType | null
    _min: SessionMinAggregateOutputType | null
    _max: SessionMaxAggregateOutputType | null
  }

  type GetSessionGroupByPayload<T extends SessionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<SessionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof SessionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], SessionGroupByOutputType[P]>
            : GetScalarType<T[P], SessionGroupByOutputType[P]>
        }
      >
    >


  export type SessionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    siteId?: boolean
    startedAt?: boolean
    lastActivity?: boolean
    website?: boolean | WebsiteDefaultArgs<ExtArgs>
    events?: boolean | Session$eventsArgs<ExtArgs>
    _count?: boolean | SessionCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["session"]>

  export type SessionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    siteId?: boolean
    startedAt?: boolean
    lastActivity?: boolean
    website?: boolean | WebsiteDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["session"]>

  export type SessionSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    siteId?: boolean
    startedAt?: boolean
    lastActivity?: boolean
    website?: boolean | WebsiteDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["session"]>

  export type SessionSelectScalar = {
    id?: boolean
    siteId?: boolean
    startedAt?: boolean
    lastActivity?: boolean
  }

  export type SessionOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "siteId" | "startedAt" | "lastActivity", ExtArgs["result"]["session"]>
  export type SessionInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    website?: boolean | WebsiteDefaultArgs<ExtArgs>
    events?: boolean | Session$eventsArgs<ExtArgs>
    _count?: boolean | SessionCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type SessionIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    website?: boolean | WebsiteDefaultArgs<ExtArgs>
  }
  export type SessionIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    website?: boolean | WebsiteDefaultArgs<ExtArgs>
  }

  export type $SessionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Session"
    objects: {
      website: Prisma.$WebsitePayload<ExtArgs>
      events: Prisma.$EventPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      siteId: string
      startedAt: Date
      lastActivity: Date
    }, ExtArgs["result"]["session"]>
    composites: {}
  }

  type SessionGetPayload<S extends boolean | null | undefined | SessionDefaultArgs> = $Result.GetResult<Prisma.$SessionPayload, S>

  type SessionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<SessionFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: SessionCountAggregateInputType | true
    }

  export interface SessionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Session'], meta: { name: 'Session' } }
    /**
     * Find zero or one Session that matches the filter.
     * @param {SessionFindUniqueArgs} args - Arguments to find a Session
     * @example
     * // Get one Session
     * const session = await prisma.session.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends SessionFindUniqueArgs>(args: SelectSubset<T, SessionFindUniqueArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Session that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {SessionFindUniqueOrThrowArgs} args - Arguments to find a Session
     * @example
     * // Get one Session
     * const session = await prisma.session.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends SessionFindUniqueOrThrowArgs>(args: SelectSubset<T, SessionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Session that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionFindFirstArgs} args - Arguments to find a Session
     * @example
     * // Get one Session
     * const session = await prisma.session.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends SessionFindFirstArgs>(args?: SelectSubset<T, SessionFindFirstArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Session that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionFindFirstOrThrowArgs} args - Arguments to find a Session
     * @example
     * // Get one Session
     * const session = await prisma.session.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends SessionFindFirstOrThrowArgs>(args?: SelectSubset<T, SessionFindFirstOrThrowArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Sessions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Sessions
     * const sessions = await prisma.session.findMany()
     * 
     * // Get first 10 Sessions
     * const sessions = await prisma.session.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const sessionWithIdOnly = await prisma.session.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends SessionFindManyArgs>(args?: SelectSubset<T, SessionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Session.
     * @param {SessionCreateArgs} args - Arguments to create a Session.
     * @example
     * // Create one Session
     * const Session = await prisma.session.create({
     *   data: {
     *     // ... data to create a Session
     *   }
     * })
     * 
     */
    create<T extends SessionCreateArgs>(args: SelectSubset<T, SessionCreateArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Sessions.
     * @param {SessionCreateManyArgs} args - Arguments to create many Sessions.
     * @example
     * // Create many Sessions
     * const session = await prisma.session.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends SessionCreateManyArgs>(args?: SelectSubset<T, SessionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Sessions and returns the data saved in the database.
     * @param {SessionCreateManyAndReturnArgs} args - Arguments to create many Sessions.
     * @example
     * // Create many Sessions
     * const session = await prisma.session.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Sessions and only return the `id`
     * const sessionWithIdOnly = await prisma.session.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends SessionCreateManyAndReturnArgs>(args?: SelectSubset<T, SessionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Session.
     * @param {SessionDeleteArgs} args - Arguments to delete one Session.
     * @example
     * // Delete one Session
     * const Session = await prisma.session.delete({
     *   where: {
     *     // ... filter to delete one Session
     *   }
     * })
     * 
     */
    delete<T extends SessionDeleteArgs>(args: SelectSubset<T, SessionDeleteArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Session.
     * @param {SessionUpdateArgs} args - Arguments to update one Session.
     * @example
     * // Update one Session
     * const session = await prisma.session.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends SessionUpdateArgs>(args: SelectSubset<T, SessionUpdateArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Sessions.
     * @param {SessionDeleteManyArgs} args - Arguments to filter Sessions to delete.
     * @example
     * // Delete a few Sessions
     * const { count } = await prisma.session.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends SessionDeleteManyArgs>(args?: SelectSubset<T, SessionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Sessions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Sessions
     * const session = await prisma.session.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends SessionUpdateManyArgs>(args: SelectSubset<T, SessionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Sessions and returns the data updated in the database.
     * @param {SessionUpdateManyAndReturnArgs} args - Arguments to update many Sessions.
     * @example
     * // Update many Sessions
     * const session = await prisma.session.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Sessions and only return the `id`
     * const sessionWithIdOnly = await prisma.session.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends SessionUpdateManyAndReturnArgs>(args: SelectSubset<T, SessionUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Session.
     * @param {SessionUpsertArgs} args - Arguments to update or create a Session.
     * @example
     * // Update or create a Session
     * const session = await prisma.session.upsert({
     *   create: {
     *     // ... data to create a Session
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Session we want to update
     *   }
     * })
     */
    upsert<T extends SessionUpsertArgs>(args: SelectSubset<T, SessionUpsertArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Sessions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionCountArgs} args - Arguments to filter Sessions to count.
     * @example
     * // Count the number of Sessions
     * const count = await prisma.session.count({
     *   where: {
     *     // ... the filter for the Sessions we want to count
     *   }
     * })
    **/
    count<T extends SessionCountArgs>(
      args?: Subset<T, SessionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], SessionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Session.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends SessionAggregateArgs>(args: Subset<T, SessionAggregateArgs>): Prisma.PrismaPromise<GetSessionAggregateType<T>>

    /**
     * Group by Session.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends SessionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: SessionGroupByArgs['orderBy'] }
        : { orderBy?: SessionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, SessionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetSessionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Session model
   */
  readonly fields: SessionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Session.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__SessionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    website<T extends WebsiteDefaultArgs<ExtArgs> = {}>(args?: Subset<T, WebsiteDefaultArgs<ExtArgs>>): Prisma__WebsiteClient<$Result.GetResult<Prisma.$WebsitePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    events<T extends Session$eventsArgs<ExtArgs> = {}>(args?: Subset<T, Session$eventsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EventPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Session model
   */
  interface SessionFieldRefs {
    readonly id: FieldRef<"Session", 'String'>
    readonly siteId: FieldRef<"Session", 'String'>
    readonly startedAt: FieldRef<"Session", 'DateTime'>
    readonly lastActivity: FieldRef<"Session", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Session findUnique
   */
  export type SessionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * Filter, which Session to fetch.
     */
    where: SessionWhereUniqueInput
  }

  /**
   * Session findUniqueOrThrow
   */
  export type SessionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * Filter, which Session to fetch.
     */
    where: SessionWhereUniqueInput
  }

  /**
   * Session findFirst
   */
  export type SessionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * Filter, which Session to fetch.
     */
    where?: SessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Sessions to fetch.
     */
    orderBy?: SessionOrderByWithRelationInput | SessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Sessions.
     */
    cursor?: SessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Sessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Sessions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Sessions.
     */
    distinct?: SessionScalarFieldEnum | SessionScalarFieldEnum[]
  }

  /**
   * Session findFirstOrThrow
   */
  export type SessionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * Filter, which Session to fetch.
     */
    where?: SessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Sessions to fetch.
     */
    orderBy?: SessionOrderByWithRelationInput | SessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Sessions.
     */
    cursor?: SessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Sessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Sessions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Sessions.
     */
    distinct?: SessionScalarFieldEnum | SessionScalarFieldEnum[]
  }

  /**
   * Session findMany
   */
  export type SessionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * Filter, which Sessions to fetch.
     */
    where?: SessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Sessions to fetch.
     */
    orderBy?: SessionOrderByWithRelationInput | SessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Sessions.
     */
    cursor?: SessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Sessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Sessions.
     */
    skip?: number
    distinct?: SessionScalarFieldEnum | SessionScalarFieldEnum[]
  }

  /**
   * Session create
   */
  export type SessionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * The data needed to create a Session.
     */
    data: XOR<SessionCreateInput, SessionUncheckedCreateInput>
  }

  /**
   * Session createMany
   */
  export type SessionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Sessions.
     */
    data: SessionCreateManyInput | SessionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Session createManyAndReturn
   */
  export type SessionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * The data used to create many Sessions.
     */
    data: SessionCreateManyInput | SessionCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Session update
   */
  export type SessionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * The data needed to update a Session.
     */
    data: XOR<SessionUpdateInput, SessionUncheckedUpdateInput>
    /**
     * Choose, which Session to update.
     */
    where: SessionWhereUniqueInput
  }

  /**
   * Session updateMany
   */
  export type SessionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Sessions.
     */
    data: XOR<SessionUpdateManyMutationInput, SessionUncheckedUpdateManyInput>
    /**
     * Filter which Sessions to update
     */
    where?: SessionWhereInput
    /**
     * Limit how many Sessions to update.
     */
    limit?: number
  }

  /**
   * Session updateManyAndReturn
   */
  export type SessionUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * The data used to update Sessions.
     */
    data: XOR<SessionUpdateManyMutationInput, SessionUncheckedUpdateManyInput>
    /**
     * Filter which Sessions to update
     */
    where?: SessionWhereInput
    /**
     * Limit how many Sessions to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Session upsert
   */
  export type SessionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * The filter to search for the Session to update in case it exists.
     */
    where: SessionWhereUniqueInput
    /**
     * In case the Session found by the `where` argument doesn't exist, create a new Session with this data.
     */
    create: XOR<SessionCreateInput, SessionUncheckedCreateInput>
    /**
     * In case the Session was found with the provided `where` argument, update it with this data.
     */
    update: XOR<SessionUpdateInput, SessionUncheckedUpdateInput>
  }

  /**
   * Session delete
   */
  export type SessionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * Filter which Session to delete.
     */
    where: SessionWhereUniqueInput
  }

  /**
   * Session deleteMany
   */
  export type SessionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Sessions to delete
     */
    where?: SessionWhereInput
    /**
     * Limit how many Sessions to delete.
     */
    limit?: number
  }

  /**
   * Session.events
   */
  export type Session$eventsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Event
     */
    select?: EventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Event
     */
    omit?: EventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EventInclude<ExtArgs> | null
    where?: EventWhereInput
    orderBy?: EventOrderByWithRelationInput | EventOrderByWithRelationInput[]
    cursor?: EventWhereUniqueInput
    take?: number
    skip?: number
    distinct?: EventScalarFieldEnum | EventScalarFieldEnum[]
  }

  /**
   * Session without action
   */
  export type SessionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
  }


  /**
   * Model Event
   */

  export type AggregateEvent = {
    _count: EventCountAggregateOutputType | null
    _min: EventMinAggregateOutputType | null
    _max: EventMaxAggregateOutputType | null
  }

  export type EventMinAggregateOutputType = {
    id: string | null
    eventId: string | null
    siteId: string | null
    sessionId: string | null
    eventType: string | null
    name: string | null
    eventTime: Date | null
    pageUrl: string | null
    pageTitle: string | null
    referrer: string | null
    deviceType: string | null
    browser: string | null
    os: string | null
    receivedAt: Date | null
  }

  export type EventMaxAggregateOutputType = {
    id: string | null
    eventId: string | null
    siteId: string | null
    sessionId: string | null
    eventType: string | null
    name: string | null
    eventTime: Date | null
    pageUrl: string | null
    pageTitle: string | null
    referrer: string | null
    deviceType: string | null
    browser: string | null
    os: string | null
    receivedAt: Date | null
  }

  export type EventCountAggregateOutputType = {
    id: number
    eventId: number
    siteId: number
    sessionId: number
    eventType: number
    name: number
    eventTime: number
    pageUrl: number
    pageTitle: number
    referrer: number
    deviceType: number
    browser: number
    os: number
    properties: number
    receivedAt: number
    _all: number
  }


  export type EventMinAggregateInputType = {
    id?: true
    eventId?: true
    siteId?: true
    sessionId?: true
    eventType?: true
    name?: true
    eventTime?: true
    pageUrl?: true
    pageTitle?: true
    referrer?: true
    deviceType?: true
    browser?: true
    os?: true
    receivedAt?: true
  }

  export type EventMaxAggregateInputType = {
    id?: true
    eventId?: true
    siteId?: true
    sessionId?: true
    eventType?: true
    name?: true
    eventTime?: true
    pageUrl?: true
    pageTitle?: true
    referrer?: true
    deviceType?: true
    browser?: true
    os?: true
    receivedAt?: true
  }

  export type EventCountAggregateInputType = {
    id?: true
    eventId?: true
    siteId?: true
    sessionId?: true
    eventType?: true
    name?: true
    eventTime?: true
    pageUrl?: true
    pageTitle?: true
    referrer?: true
    deviceType?: true
    browser?: true
    os?: true
    properties?: true
    receivedAt?: true
    _all?: true
  }

  export type EventAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Event to aggregate.
     */
    where?: EventWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Events to fetch.
     */
    orderBy?: EventOrderByWithRelationInput | EventOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: EventWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Events from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Events.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Events
    **/
    _count?: true | EventCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: EventMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: EventMaxAggregateInputType
  }

  export type GetEventAggregateType<T extends EventAggregateArgs> = {
        [P in keyof T & keyof AggregateEvent]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateEvent[P]>
      : GetScalarType<T[P], AggregateEvent[P]>
  }




  export type EventGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: EventWhereInput
    orderBy?: EventOrderByWithAggregationInput | EventOrderByWithAggregationInput[]
    by: EventScalarFieldEnum[] | EventScalarFieldEnum
    having?: EventScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: EventCountAggregateInputType | true
    _min?: EventMinAggregateInputType
    _max?: EventMaxAggregateInputType
  }

  export type EventGroupByOutputType = {
    id: string
    eventId: string
    siteId: string
    sessionId: string
    eventType: string
    name: string | null
    eventTime: Date
    pageUrl: string
    pageTitle: string
    referrer: string | null
    deviceType: string
    browser: string
    os: string
    properties: JsonValue | null
    receivedAt: Date
    _count: EventCountAggregateOutputType | null
    _min: EventMinAggregateOutputType | null
    _max: EventMaxAggregateOutputType | null
  }

  type GetEventGroupByPayload<T extends EventGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<EventGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof EventGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], EventGroupByOutputType[P]>
            : GetScalarType<T[P], EventGroupByOutputType[P]>
        }
      >
    >


  export type EventSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    eventId?: boolean
    siteId?: boolean
    sessionId?: boolean
    eventType?: boolean
    name?: boolean
    eventTime?: boolean
    pageUrl?: boolean
    pageTitle?: boolean
    referrer?: boolean
    deviceType?: boolean
    browser?: boolean
    os?: boolean
    properties?: boolean
    receivedAt?: boolean
    website?: boolean | WebsiteDefaultArgs<ExtArgs>
    session?: boolean | SessionDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["event"]>

  export type EventSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    eventId?: boolean
    siteId?: boolean
    sessionId?: boolean
    eventType?: boolean
    name?: boolean
    eventTime?: boolean
    pageUrl?: boolean
    pageTitle?: boolean
    referrer?: boolean
    deviceType?: boolean
    browser?: boolean
    os?: boolean
    properties?: boolean
    receivedAt?: boolean
    website?: boolean | WebsiteDefaultArgs<ExtArgs>
    session?: boolean | SessionDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["event"]>

  export type EventSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    eventId?: boolean
    siteId?: boolean
    sessionId?: boolean
    eventType?: boolean
    name?: boolean
    eventTime?: boolean
    pageUrl?: boolean
    pageTitle?: boolean
    referrer?: boolean
    deviceType?: boolean
    browser?: boolean
    os?: boolean
    properties?: boolean
    receivedAt?: boolean
    website?: boolean | WebsiteDefaultArgs<ExtArgs>
    session?: boolean | SessionDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["event"]>

  export type EventSelectScalar = {
    id?: boolean
    eventId?: boolean
    siteId?: boolean
    sessionId?: boolean
    eventType?: boolean
    name?: boolean
    eventTime?: boolean
    pageUrl?: boolean
    pageTitle?: boolean
    referrer?: boolean
    deviceType?: boolean
    browser?: boolean
    os?: boolean
    properties?: boolean
    receivedAt?: boolean
  }

  export type EventOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "eventId" | "siteId" | "sessionId" | "eventType" | "name" | "eventTime" | "pageUrl" | "pageTitle" | "referrer" | "deviceType" | "browser" | "os" | "properties" | "receivedAt", ExtArgs["result"]["event"]>
  export type EventInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    website?: boolean | WebsiteDefaultArgs<ExtArgs>
    session?: boolean | SessionDefaultArgs<ExtArgs>
  }
  export type EventIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    website?: boolean | WebsiteDefaultArgs<ExtArgs>
    session?: boolean | SessionDefaultArgs<ExtArgs>
  }
  export type EventIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    website?: boolean | WebsiteDefaultArgs<ExtArgs>
    session?: boolean | SessionDefaultArgs<ExtArgs>
  }

  export type $EventPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Event"
    objects: {
      website: Prisma.$WebsitePayload<ExtArgs>
      /**
       * Composite FK: an event can only reference a session that belongs to the
       * same site. This makes cross-tenant session reuse impossible at the DB level.
       */
      session: Prisma.$SessionPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      eventId: string
      siteId: string
      sessionId: string
      eventType: string
      name: string | null
      eventTime: Date
      pageUrl: string
      pageTitle: string
      referrer: string | null
      deviceType: string
      browser: string
      os: string
      properties: Prisma.JsonValue | null
      receivedAt: Date
    }, ExtArgs["result"]["event"]>
    composites: {}
  }

  type EventGetPayload<S extends boolean | null | undefined | EventDefaultArgs> = $Result.GetResult<Prisma.$EventPayload, S>

  type EventCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<EventFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: EventCountAggregateInputType | true
    }

  export interface EventDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Event'], meta: { name: 'Event' } }
    /**
     * Find zero or one Event that matches the filter.
     * @param {EventFindUniqueArgs} args - Arguments to find a Event
     * @example
     * // Get one Event
     * const event = await prisma.event.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends EventFindUniqueArgs>(args: SelectSubset<T, EventFindUniqueArgs<ExtArgs>>): Prisma__EventClient<$Result.GetResult<Prisma.$EventPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Event that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {EventFindUniqueOrThrowArgs} args - Arguments to find a Event
     * @example
     * // Get one Event
     * const event = await prisma.event.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends EventFindUniqueOrThrowArgs>(args: SelectSubset<T, EventFindUniqueOrThrowArgs<ExtArgs>>): Prisma__EventClient<$Result.GetResult<Prisma.$EventPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Event that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EventFindFirstArgs} args - Arguments to find a Event
     * @example
     * // Get one Event
     * const event = await prisma.event.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends EventFindFirstArgs>(args?: SelectSubset<T, EventFindFirstArgs<ExtArgs>>): Prisma__EventClient<$Result.GetResult<Prisma.$EventPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Event that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EventFindFirstOrThrowArgs} args - Arguments to find a Event
     * @example
     * // Get one Event
     * const event = await prisma.event.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends EventFindFirstOrThrowArgs>(args?: SelectSubset<T, EventFindFirstOrThrowArgs<ExtArgs>>): Prisma__EventClient<$Result.GetResult<Prisma.$EventPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Events that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EventFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Events
     * const events = await prisma.event.findMany()
     * 
     * // Get first 10 Events
     * const events = await prisma.event.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const eventWithIdOnly = await prisma.event.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends EventFindManyArgs>(args?: SelectSubset<T, EventFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EventPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Event.
     * @param {EventCreateArgs} args - Arguments to create a Event.
     * @example
     * // Create one Event
     * const Event = await prisma.event.create({
     *   data: {
     *     // ... data to create a Event
     *   }
     * })
     * 
     */
    create<T extends EventCreateArgs>(args: SelectSubset<T, EventCreateArgs<ExtArgs>>): Prisma__EventClient<$Result.GetResult<Prisma.$EventPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Events.
     * @param {EventCreateManyArgs} args - Arguments to create many Events.
     * @example
     * // Create many Events
     * const event = await prisma.event.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends EventCreateManyArgs>(args?: SelectSubset<T, EventCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Events and returns the data saved in the database.
     * @param {EventCreateManyAndReturnArgs} args - Arguments to create many Events.
     * @example
     * // Create many Events
     * const event = await prisma.event.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Events and only return the `id`
     * const eventWithIdOnly = await prisma.event.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends EventCreateManyAndReturnArgs>(args?: SelectSubset<T, EventCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EventPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Event.
     * @param {EventDeleteArgs} args - Arguments to delete one Event.
     * @example
     * // Delete one Event
     * const Event = await prisma.event.delete({
     *   where: {
     *     // ... filter to delete one Event
     *   }
     * })
     * 
     */
    delete<T extends EventDeleteArgs>(args: SelectSubset<T, EventDeleteArgs<ExtArgs>>): Prisma__EventClient<$Result.GetResult<Prisma.$EventPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Event.
     * @param {EventUpdateArgs} args - Arguments to update one Event.
     * @example
     * // Update one Event
     * const event = await prisma.event.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends EventUpdateArgs>(args: SelectSubset<T, EventUpdateArgs<ExtArgs>>): Prisma__EventClient<$Result.GetResult<Prisma.$EventPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Events.
     * @param {EventDeleteManyArgs} args - Arguments to filter Events to delete.
     * @example
     * // Delete a few Events
     * const { count } = await prisma.event.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends EventDeleteManyArgs>(args?: SelectSubset<T, EventDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Events.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EventUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Events
     * const event = await prisma.event.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends EventUpdateManyArgs>(args: SelectSubset<T, EventUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Events and returns the data updated in the database.
     * @param {EventUpdateManyAndReturnArgs} args - Arguments to update many Events.
     * @example
     * // Update many Events
     * const event = await prisma.event.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Events and only return the `id`
     * const eventWithIdOnly = await prisma.event.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends EventUpdateManyAndReturnArgs>(args: SelectSubset<T, EventUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EventPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Event.
     * @param {EventUpsertArgs} args - Arguments to update or create a Event.
     * @example
     * // Update or create a Event
     * const event = await prisma.event.upsert({
     *   create: {
     *     // ... data to create a Event
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Event we want to update
     *   }
     * })
     */
    upsert<T extends EventUpsertArgs>(args: SelectSubset<T, EventUpsertArgs<ExtArgs>>): Prisma__EventClient<$Result.GetResult<Prisma.$EventPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Events.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EventCountArgs} args - Arguments to filter Events to count.
     * @example
     * // Count the number of Events
     * const count = await prisma.event.count({
     *   where: {
     *     // ... the filter for the Events we want to count
     *   }
     * })
    **/
    count<T extends EventCountArgs>(
      args?: Subset<T, EventCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], EventCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Event.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EventAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends EventAggregateArgs>(args: Subset<T, EventAggregateArgs>): Prisma.PrismaPromise<GetEventAggregateType<T>>

    /**
     * Group by Event.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EventGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends EventGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: EventGroupByArgs['orderBy'] }
        : { orderBy?: EventGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, EventGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetEventGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Event model
   */
  readonly fields: EventFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Event.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__EventClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    website<T extends WebsiteDefaultArgs<ExtArgs> = {}>(args?: Subset<T, WebsiteDefaultArgs<ExtArgs>>): Prisma__WebsiteClient<$Result.GetResult<Prisma.$WebsitePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    session<T extends SessionDefaultArgs<ExtArgs> = {}>(args?: Subset<T, SessionDefaultArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Event model
   */
  interface EventFieldRefs {
    readonly id: FieldRef<"Event", 'String'>
    readonly eventId: FieldRef<"Event", 'String'>
    readonly siteId: FieldRef<"Event", 'String'>
    readonly sessionId: FieldRef<"Event", 'String'>
    readonly eventType: FieldRef<"Event", 'String'>
    readonly name: FieldRef<"Event", 'String'>
    readonly eventTime: FieldRef<"Event", 'DateTime'>
    readonly pageUrl: FieldRef<"Event", 'String'>
    readonly pageTitle: FieldRef<"Event", 'String'>
    readonly referrer: FieldRef<"Event", 'String'>
    readonly deviceType: FieldRef<"Event", 'String'>
    readonly browser: FieldRef<"Event", 'String'>
    readonly os: FieldRef<"Event", 'String'>
    readonly properties: FieldRef<"Event", 'Json'>
    readonly receivedAt: FieldRef<"Event", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Event findUnique
   */
  export type EventFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Event
     */
    select?: EventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Event
     */
    omit?: EventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EventInclude<ExtArgs> | null
    /**
     * Filter, which Event to fetch.
     */
    where: EventWhereUniqueInput
  }

  /**
   * Event findUniqueOrThrow
   */
  export type EventFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Event
     */
    select?: EventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Event
     */
    omit?: EventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EventInclude<ExtArgs> | null
    /**
     * Filter, which Event to fetch.
     */
    where: EventWhereUniqueInput
  }

  /**
   * Event findFirst
   */
  export type EventFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Event
     */
    select?: EventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Event
     */
    omit?: EventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EventInclude<ExtArgs> | null
    /**
     * Filter, which Event to fetch.
     */
    where?: EventWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Events to fetch.
     */
    orderBy?: EventOrderByWithRelationInput | EventOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Events.
     */
    cursor?: EventWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Events from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Events.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Events.
     */
    distinct?: EventScalarFieldEnum | EventScalarFieldEnum[]
  }

  /**
   * Event findFirstOrThrow
   */
  export type EventFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Event
     */
    select?: EventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Event
     */
    omit?: EventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EventInclude<ExtArgs> | null
    /**
     * Filter, which Event to fetch.
     */
    where?: EventWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Events to fetch.
     */
    orderBy?: EventOrderByWithRelationInput | EventOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Events.
     */
    cursor?: EventWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Events from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Events.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Events.
     */
    distinct?: EventScalarFieldEnum | EventScalarFieldEnum[]
  }

  /**
   * Event findMany
   */
  export type EventFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Event
     */
    select?: EventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Event
     */
    omit?: EventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EventInclude<ExtArgs> | null
    /**
     * Filter, which Events to fetch.
     */
    where?: EventWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Events to fetch.
     */
    orderBy?: EventOrderByWithRelationInput | EventOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Events.
     */
    cursor?: EventWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Events from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Events.
     */
    skip?: number
    distinct?: EventScalarFieldEnum | EventScalarFieldEnum[]
  }

  /**
   * Event create
   */
  export type EventCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Event
     */
    select?: EventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Event
     */
    omit?: EventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EventInclude<ExtArgs> | null
    /**
     * The data needed to create a Event.
     */
    data: XOR<EventCreateInput, EventUncheckedCreateInput>
  }

  /**
   * Event createMany
   */
  export type EventCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Events.
     */
    data: EventCreateManyInput | EventCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Event createManyAndReturn
   */
  export type EventCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Event
     */
    select?: EventSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Event
     */
    omit?: EventOmit<ExtArgs> | null
    /**
     * The data used to create many Events.
     */
    data: EventCreateManyInput | EventCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EventIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Event update
   */
  export type EventUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Event
     */
    select?: EventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Event
     */
    omit?: EventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EventInclude<ExtArgs> | null
    /**
     * The data needed to update a Event.
     */
    data: XOR<EventUpdateInput, EventUncheckedUpdateInput>
    /**
     * Choose, which Event to update.
     */
    where: EventWhereUniqueInput
  }

  /**
   * Event updateMany
   */
  export type EventUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Events.
     */
    data: XOR<EventUpdateManyMutationInput, EventUncheckedUpdateManyInput>
    /**
     * Filter which Events to update
     */
    where?: EventWhereInput
    /**
     * Limit how many Events to update.
     */
    limit?: number
  }

  /**
   * Event updateManyAndReturn
   */
  export type EventUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Event
     */
    select?: EventSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Event
     */
    omit?: EventOmit<ExtArgs> | null
    /**
     * The data used to update Events.
     */
    data: XOR<EventUpdateManyMutationInput, EventUncheckedUpdateManyInput>
    /**
     * Filter which Events to update
     */
    where?: EventWhereInput
    /**
     * Limit how many Events to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EventIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Event upsert
   */
  export type EventUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Event
     */
    select?: EventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Event
     */
    omit?: EventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EventInclude<ExtArgs> | null
    /**
     * The filter to search for the Event to update in case it exists.
     */
    where: EventWhereUniqueInput
    /**
     * In case the Event found by the `where` argument doesn't exist, create a new Event with this data.
     */
    create: XOR<EventCreateInput, EventUncheckedCreateInput>
    /**
     * In case the Event was found with the provided `where` argument, update it with this data.
     */
    update: XOR<EventUpdateInput, EventUncheckedUpdateInput>
  }

  /**
   * Event delete
   */
  export type EventDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Event
     */
    select?: EventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Event
     */
    omit?: EventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EventInclude<ExtArgs> | null
    /**
     * Filter which Event to delete.
     */
    where: EventWhereUniqueInput
  }

  /**
   * Event deleteMany
   */
  export type EventDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Events to delete
     */
    where?: EventWhereInput
    /**
     * Limit how many Events to delete.
     */
    limit?: number
  }

  /**
   * Event without action
   */
  export type EventDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Event
     */
    select?: EventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Event
     */
    omit?: EventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EventInclude<ExtArgs> | null
  }


  /**
   * Model Principal
   */

  export type AggregatePrincipal = {
    _count: PrincipalCountAggregateOutputType | null
    _min: PrincipalMinAggregateOutputType | null
    _max: PrincipalMaxAggregateOutputType | null
  }

  export type PrincipalMinAggregateOutputType = {
    id: string | null
    siteId: string | null
    externalId: string | null
    kind: string | null
    createdAt: Date | null
  }

  export type PrincipalMaxAggregateOutputType = {
    id: string | null
    siteId: string | null
    externalId: string | null
    kind: string | null
    createdAt: Date | null
  }

  export type PrincipalCountAggregateOutputType = {
    id: number
    siteId: number
    externalId: number
    kind: number
    createdAt: number
    _all: number
  }


  export type PrincipalMinAggregateInputType = {
    id?: true
    siteId?: true
    externalId?: true
    kind?: true
    createdAt?: true
  }

  export type PrincipalMaxAggregateInputType = {
    id?: true
    siteId?: true
    externalId?: true
    kind?: true
    createdAt?: true
  }

  export type PrincipalCountAggregateInputType = {
    id?: true
    siteId?: true
    externalId?: true
    kind?: true
    createdAt?: true
    _all?: true
  }

  export type PrincipalAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Principal to aggregate.
     */
    where?: PrincipalWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Principals to fetch.
     */
    orderBy?: PrincipalOrderByWithRelationInput | PrincipalOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PrincipalWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Principals from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Principals.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Principals
    **/
    _count?: true | PrincipalCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PrincipalMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PrincipalMaxAggregateInputType
  }

  export type GetPrincipalAggregateType<T extends PrincipalAggregateArgs> = {
        [P in keyof T & keyof AggregatePrincipal]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePrincipal[P]>
      : GetScalarType<T[P], AggregatePrincipal[P]>
  }




  export type PrincipalGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PrincipalWhereInput
    orderBy?: PrincipalOrderByWithAggregationInput | PrincipalOrderByWithAggregationInput[]
    by: PrincipalScalarFieldEnum[] | PrincipalScalarFieldEnum
    having?: PrincipalScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PrincipalCountAggregateInputType | true
    _min?: PrincipalMinAggregateInputType
    _max?: PrincipalMaxAggregateInputType
  }

  export type PrincipalGroupByOutputType = {
    id: string
    siteId: string
    externalId: string
    kind: string
    createdAt: Date
    _count: PrincipalCountAggregateOutputType | null
    _min: PrincipalMinAggregateOutputType | null
    _max: PrincipalMaxAggregateOutputType | null
  }

  type GetPrincipalGroupByPayload<T extends PrincipalGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PrincipalGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PrincipalGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PrincipalGroupByOutputType[P]>
            : GetScalarType<T[P], PrincipalGroupByOutputType[P]>
        }
      >
    >


  export type PrincipalSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    siteId?: boolean
    externalId?: boolean
    kind?: boolean
    createdAt?: boolean
    website?: boolean | WebsiteDefaultArgs<ExtArgs>
    consentRecords?: boolean | Principal$consentRecordsArgs<ExtArgs>
    _count?: boolean | PrincipalCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["principal"]>

  export type PrincipalSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    siteId?: boolean
    externalId?: boolean
    kind?: boolean
    createdAt?: boolean
    website?: boolean | WebsiteDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["principal"]>

  export type PrincipalSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    siteId?: boolean
    externalId?: boolean
    kind?: boolean
    createdAt?: boolean
    website?: boolean | WebsiteDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["principal"]>

  export type PrincipalSelectScalar = {
    id?: boolean
    siteId?: boolean
    externalId?: boolean
    kind?: boolean
    createdAt?: boolean
  }

  export type PrincipalOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "siteId" | "externalId" | "kind" | "createdAt", ExtArgs["result"]["principal"]>
  export type PrincipalInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    website?: boolean | WebsiteDefaultArgs<ExtArgs>
    consentRecords?: boolean | Principal$consentRecordsArgs<ExtArgs>
    _count?: boolean | PrincipalCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type PrincipalIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    website?: boolean | WebsiteDefaultArgs<ExtArgs>
  }
  export type PrincipalIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    website?: boolean | WebsiteDefaultArgs<ExtArgs>
  }

  export type $PrincipalPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Principal"
    objects: {
      website: Prisma.$WebsitePayload<ExtArgs>
      consentRecords: Prisma.$ConsentRecordPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      siteId: string
      /**
       * The site's own identifier for this person. Opaque to us.
       */
      externalId: string
      /**
       * "anonymous" | "identified" - open-ended by design.
       */
      kind: string
      createdAt: Date
    }, ExtArgs["result"]["principal"]>
    composites: {}
  }

  type PrincipalGetPayload<S extends boolean | null | undefined | PrincipalDefaultArgs> = $Result.GetResult<Prisma.$PrincipalPayload, S>

  type PrincipalCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<PrincipalFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PrincipalCountAggregateInputType | true
    }

  export interface PrincipalDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Principal'], meta: { name: 'Principal' } }
    /**
     * Find zero or one Principal that matches the filter.
     * @param {PrincipalFindUniqueArgs} args - Arguments to find a Principal
     * @example
     * // Get one Principal
     * const principal = await prisma.principal.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PrincipalFindUniqueArgs>(args: SelectSubset<T, PrincipalFindUniqueArgs<ExtArgs>>): Prisma__PrincipalClient<$Result.GetResult<Prisma.$PrincipalPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Principal that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PrincipalFindUniqueOrThrowArgs} args - Arguments to find a Principal
     * @example
     * // Get one Principal
     * const principal = await prisma.principal.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PrincipalFindUniqueOrThrowArgs>(args: SelectSubset<T, PrincipalFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PrincipalClient<$Result.GetResult<Prisma.$PrincipalPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Principal that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PrincipalFindFirstArgs} args - Arguments to find a Principal
     * @example
     * // Get one Principal
     * const principal = await prisma.principal.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PrincipalFindFirstArgs>(args?: SelectSubset<T, PrincipalFindFirstArgs<ExtArgs>>): Prisma__PrincipalClient<$Result.GetResult<Prisma.$PrincipalPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Principal that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PrincipalFindFirstOrThrowArgs} args - Arguments to find a Principal
     * @example
     * // Get one Principal
     * const principal = await prisma.principal.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PrincipalFindFirstOrThrowArgs>(args?: SelectSubset<T, PrincipalFindFirstOrThrowArgs<ExtArgs>>): Prisma__PrincipalClient<$Result.GetResult<Prisma.$PrincipalPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Principals that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PrincipalFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Principals
     * const principals = await prisma.principal.findMany()
     * 
     * // Get first 10 Principals
     * const principals = await prisma.principal.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const principalWithIdOnly = await prisma.principal.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PrincipalFindManyArgs>(args?: SelectSubset<T, PrincipalFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PrincipalPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Principal.
     * @param {PrincipalCreateArgs} args - Arguments to create a Principal.
     * @example
     * // Create one Principal
     * const Principal = await prisma.principal.create({
     *   data: {
     *     // ... data to create a Principal
     *   }
     * })
     * 
     */
    create<T extends PrincipalCreateArgs>(args: SelectSubset<T, PrincipalCreateArgs<ExtArgs>>): Prisma__PrincipalClient<$Result.GetResult<Prisma.$PrincipalPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Principals.
     * @param {PrincipalCreateManyArgs} args - Arguments to create many Principals.
     * @example
     * // Create many Principals
     * const principal = await prisma.principal.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PrincipalCreateManyArgs>(args?: SelectSubset<T, PrincipalCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Principals and returns the data saved in the database.
     * @param {PrincipalCreateManyAndReturnArgs} args - Arguments to create many Principals.
     * @example
     * // Create many Principals
     * const principal = await prisma.principal.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Principals and only return the `id`
     * const principalWithIdOnly = await prisma.principal.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PrincipalCreateManyAndReturnArgs>(args?: SelectSubset<T, PrincipalCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PrincipalPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Principal.
     * @param {PrincipalDeleteArgs} args - Arguments to delete one Principal.
     * @example
     * // Delete one Principal
     * const Principal = await prisma.principal.delete({
     *   where: {
     *     // ... filter to delete one Principal
     *   }
     * })
     * 
     */
    delete<T extends PrincipalDeleteArgs>(args: SelectSubset<T, PrincipalDeleteArgs<ExtArgs>>): Prisma__PrincipalClient<$Result.GetResult<Prisma.$PrincipalPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Principal.
     * @param {PrincipalUpdateArgs} args - Arguments to update one Principal.
     * @example
     * // Update one Principal
     * const principal = await prisma.principal.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PrincipalUpdateArgs>(args: SelectSubset<T, PrincipalUpdateArgs<ExtArgs>>): Prisma__PrincipalClient<$Result.GetResult<Prisma.$PrincipalPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Principals.
     * @param {PrincipalDeleteManyArgs} args - Arguments to filter Principals to delete.
     * @example
     * // Delete a few Principals
     * const { count } = await prisma.principal.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PrincipalDeleteManyArgs>(args?: SelectSubset<T, PrincipalDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Principals.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PrincipalUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Principals
     * const principal = await prisma.principal.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PrincipalUpdateManyArgs>(args: SelectSubset<T, PrincipalUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Principals and returns the data updated in the database.
     * @param {PrincipalUpdateManyAndReturnArgs} args - Arguments to update many Principals.
     * @example
     * // Update many Principals
     * const principal = await prisma.principal.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Principals and only return the `id`
     * const principalWithIdOnly = await prisma.principal.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends PrincipalUpdateManyAndReturnArgs>(args: SelectSubset<T, PrincipalUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PrincipalPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Principal.
     * @param {PrincipalUpsertArgs} args - Arguments to update or create a Principal.
     * @example
     * // Update or create a Principal
     * const principal = await prisma.principal.upsert({
     *   create: {
     *     // ... data to create a Principal
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Principal we want to update
     *   }
     * })
     */
    upsert<T extends PrincipalUpsertArgs>(args: SelectSubset<T, PrincipalUpsertArgs<ExtArgs>>): Prisma__PrincipalClient<$Result.GetResult<Prisma.$PrincipalPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Principals.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PrincipalCountArgs} args - Arguments to filter Principals to count.
     * @example
     * // Count the number of Principals
     * const count = await prisma.principal.count({
     *   where: {
     *     // ... the filter for the Principals we want to count
     *   }
     * })
    **/
    count<T extends PrincipalCountArgs>(
      args?: Subset<T, PrincipalCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PrincipalCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Principal.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PrincipalAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PrincipalAggregateArgs>(args: Subset<T, PrincipalAggregateArgs>): Prisma.PrismaPromise<GetPrincipalAggregateType<T>>

    /**
     * Group by Principal.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PrincipalGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PrincipalGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PrincipalGroupByArgs['orderBy'] }
        : { orderBy?: PrincipalGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PrincipalGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPrincipalGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Principal model
   */
  readonly fields: PrincipalFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Principal.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PrincipalClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    website<T extends WebsiteDefaultArgs<ExtArgs> = {}>(args?: Subset<T, WebsiteDefaultArgs<ExtArgs>>): Prisma__WebsiteClient<$Result.GetResult<Prisma.$WebsitePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    consentRecords<T extends Principal$consentRecordsArgs<ExtArgs> = {}>(args?: Subset<T, Principal$consentRecordsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ConsentRecordPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Principal model
   */
  interface PrincipalFieldRefs {
    readonly id: FieldRef<"Principal", 'String'>
    readonly siteId: FieldRef<"Principal", 'String'>
    readonly externalId: FieldRef<"Principal", 'String'>
    readonly kind: FieldRef<"Principal", 'String'>
    readonly createdAt: FieldRef<"Principal", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Principal findUnique
   */
  export type PrincipalFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Principal
     */
    select?: PrincipalSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Principal
     */
    omit?: PrincipalOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PrincipalInclude<ExtArgs> | null
    /**
     * Filter, which Principal to fetch.
     */
    where: PrincipalWhereUniqueInput
  }

  /**
   * Principal findUniqueOrThrow
   */
  export type PrincipalFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Principal
     */
    select?: PrincipalSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Principal
     */
    omit?: PrincipalOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PrincipalInclude<ExtArgs> | null
    /**
     * Filter, which Principal to fetch.
     */
    where: PrincipalWhereUniqueInput
  }

  /**
   * Principal findFirst
   */
  export type PrincipalFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Principal
     */
    select?: PrincipalSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Principal
     */
    omit?: PrincipalOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PrincipalInclude<ExtArgs> | null
    /**
     * Filter, which Principal to fetch.
     */
    where?: PrincipalWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Principals to fetch.
     */
    orderBy?: PrincipalOrderByWithRelationInput | PrincipalOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Principals.
     */
    cursor?: PrincipalWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Principals from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Principals.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Principals.
     */
    distinct?: PrincipalScalarFieldEnum | PrincipalScalarFieldEnum[]
  }

  /**
   * Principal findFirstOrThrow
   */
  export type PrincipalFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Principal
     */
    select?: PrincipalSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Principal
     */
    omit?: PrincipalOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PrincipalInclude<ExtArgs> | null
    /**
     * Filter, which Principal to fetch.
     */
    where?: PrincipalWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Principals to fetch.
     */
    orderBy?: PrincipalOrderByWithRelationInput | PrincipalOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Principals.
     */
    cursor?: PrincipalWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Principals from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Principals.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Principals.
     */
    distinct?: PrincipalScalarFieldEnum | PrincipalScalarFieldEnum[]
  }

  /**
   * Principal findMany
   */
  export type PrincipalFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Principal
     */
    select?: PrincipalSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Principal
     */
    omit?: PrincipalOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PrincipalInclude<ExtArgs> | null
    /**
     * Filter, which Principals to fetch.
     */
    where?: PrincipalWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Principals to fetch.
     */
    orderBy?: PrincipalOrderByWithRelationInput | PrincipalOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Principals.
     */
    cursor?: PrincipalWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Principals from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Principals.
     */
    skip?: number
    distinct?: PrincipalScalarFieldEnum | PrincipalScalarFieldEnum[]
  }

  /**
   * Principal create
   */
  export type PrincipalCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Principal
     */
    select?: PrincipalSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Principal
     */
    omit?: PrincipalOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PrincipalInclude<ExtArgs> | null
    /**
     * The data needed to create a Principal.
     */
    data: XOR<PrincipalCreateInput, PrincipalUncheckedCreateInput>
  }

  /**
   * Principal createMany
   */
  export type PrincipalCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Principals.
     */
    data: PrincipalCreateManyInput | PrincipalCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Principal createManyAndReturn
   */
  export type PrincipalCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Principal
     */
    select?: PrincipalSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Principal
     */
    omit?: PrincipalOmit<ExtArgs> | null
    /**
     * The data used to create many Principals.
     */
    data: PrincipalCreateManyInput | PrincipalCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PrincipalIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Principal update
   */
  export type PrincipalUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Principal
     */
    select?: PrincipalSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Principal
     */
    omit?: PrincipalOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PrincipalInclude<ExtArgs> | null
    /**
     * The data needed to update a Principal.
     */
    data: XOR<PrincipalUpdateInput, PrincipalUncheckedUpdateInput>
    /**
     * Choose, which Principal to update.
     */
    where: PrincipalWhereUniqueInput
  }

  /**
   * Principal updateMany
   */
  export type PrincipalUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Principals.
     */
    data: XOR<PrincipalUpdateManyMutationInput, PrincipalUncheckedUpdateManyInput>
    /**
     * Filter which Principals to update
     */
    where?: PrincipalWhereInput
    /**
     * Limit how many Principals to update.
     */
    limit?: number
  }

  /**
   * Principal updateManyAndReturn
   */
  export type PrincipalUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Principal
     */
    select?: PrincipalSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Principal
     */
    omit?: PrincipalOmit<ExtArgs> | null
    /**
     * The data used to update Principals.
     */
    data: XOR<PrincipalUpdateManyMutationInput, PrincipalUncheckedUpdateManyInput>
    /**
     * Filter which Principals to update
     */
    where?: PrincipalWhereInput
    /**
     * Limit how many Principals to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PrincipalIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Principal upsert
   */
  export type PrincipalUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Principal
     */
    select?: PrincipalSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Principal
     */
    omit?: PrincipalOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PrincipalInclude<ExtArgs> | null
    /**
     * The filter to search for the Principal to update in case it exists.
     */
    where: PrincipalWhereUniqueInput
    /**
     * In case the Principal found by the `where` argument doesn't exist, create a new Principal with this data.
     */
    create: XOR<PrincipalCreateInput, PrincipalUncheckedCreateInput>
    /**
     * In case the Principal was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PrincipalUpdateInput, PrincipalUncheckedUpdateInput>
  }

  /**
   * Principal delete
   */
  export type PrincipalDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Principal
     */
    select?: PrincipalSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Principal
     */
    omit?: PrincipalOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PrincipalInclude<ExtArgs> | null
    /**
     * Filter which Principal to delete.
     */
    where: PrincipalWhereUniqueInput
  }

  /**
   * Principal deleteMany
   */
  export type PrincipalDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Principals to delete
     */
    where?: PrincipalWhereInput
    /**
     * Limit how many Principals to delete.
     */
    limit?: number
  }

  /**
   * Principal.consentRecords
   */
  export type Principal$consentRecordsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConsentRecord
     */
    select?: ConsentRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ConsentRecord
     */
    omit?: ConsentRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConsentRecordInclude<ExtArgs> | null
    where?: ConsentRecordWhereInput
    orderBy?: ConsentRecordOrderByWithRelationInput | ConsentRecordOrderByWithRelationInput[]
    cursor?: ConsentRecordWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ConsentRecordScalarFieldEnum | ConsentRecordScalarFieldEnum[]
  }

  /**
   * Principal without action
   */
  export type PrincipalDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Principal
     */
    select?: PrincipalSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Principal
     */
    omit?: PrincipalOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PrincipalInclude<ExtArgs> | null
  }


  /**
   * Model Purpose
   */

  export type AggregatePurpose = {
    _count: PurposeCountAggregateOutputType | null
    _min: PurposeMinAggregateOutputType | null
    _max: PurposeMaxAggregateOutputType | null
  }

  export type PurposeMinAggregateOutputType = {
    id: string | null
    organisationId: string | null
    code: string | null
    name: string | null
    description: string | null
    isActive: boolean | null
    createdAt: Date | null
  }

  export type PurposeMaxAggregateOutputType = {
    id: string | null
    organisationId: string | null
    code: string | null
    name: string | null
    description: string | null
    isActive: boolean | null
    createdAt: Date | null
  }

  export type PurposeCountAggregateOutputType = {
    id: number
    organisationId: number
    code: number
    name: number
    description: number
    isActive: number
    createdAt: number
    _all: number
  }


  export type PurposeMinAggregateInputType = {
    id?: true
    organisationId?: true
    code?: true
    name?: true
    description?: true
    isActive?: true
    createdAt?: true
  }

  export type PurposeMaxAggregateInputType = {
    id?: true
    organisationId?: true
    code?: true
    name?: true
    description?: true
    isActive?: true
    createdAt?: true
  }

  export type PurposeCountAggregateInputType = {
    id?: true
    organisationId?: true
    code?: true
    name?: true
    description?: true
    isActive?: true
    createdAt?: true
    _all?: true
  }

  export type PurposeAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Purpose to aggregate.
     */
    where?: PurposeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Purposes to fetch.
     */
    orderBy?: PurposeOrderByWithRelationInput | PurposeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PurposeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Purposes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Purposes.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Purposes
    **/
    _count?: true | PurposeCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PurposeMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PurposeMaxAggregateInputType
  }

  export type GetPurposeAggregateType<T extends PurposeAggregateArgs> = {
        [P in keyof T & keyof AggregatePurpose]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePurpose[P]>
      : GetScalarType<T[P], AggregatePurpose[P]>
  }




  export type PurposeGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PurposeWhereInput
    orderBy?: PurposeOrderByWithAggregationInput | PurposeOrderByWithAggregationInput[]
    by: PurposeScalarFieldEnum[] | PurposeScalarFieldEnum
    having?: PurposeScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PurposeCountAggregateInputType | true
    _min?: PurposeMinAggregateInputType
    _max?: PurposeMaxAggregateInputType
  }

  export type PurposeGroupByOutputType = {
    id: string
    organisationId: string
    code: string
    name: string
    description: string
    isActive: boolean
    createdAt: Date
    _count: PurposeCountAggregateOutputType | null
    _min: PurposeMinAggregateOutputType | null
    _max: PurposeMaxAggregateOutputType | null
  }

  type GetPurposeGroupByPayload<T extends PurposeGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PurposeGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PurposeGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PurposeGroupByOutputType[P]>
            : GetScalarType<T[P], PurposeGroupByOutputType[P]>
        }
      >
    >


  export type PurposeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organisationId?: boolean
    code?: boolean
    name?: boolean
    description?: boolean
    isActive?: boolean
    createdAt?: boolean
    organisation?: boolean | OrganisationDefaultArgs<ExtArgs>
    noticePurposes?: boolean | Purpose$noticePurposesArgs<ExtArgs>
    consentRecords?: boolean | Purpose$consentRecordsArgs<ExtArgs>
    _count?: boolean | PurposeCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["purpose"]>

  export type PurposeSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organisationId?: boolean
    code?: boolean
    name?: boolean
    description?: boolean
    isActive?: boolean
    createdAt?: boolean
    organisation?: boolean | OrganisationDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["purpose"]>

  export type PurposeSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organisationId?: boolean
    code?: boolean
    name?: boolean
    description?: boolean
    isActive?: boolean
    createdAt?: boolean
    organisation?: boolean | OrganisationDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["purpose"]>

  export type PurposeSelectScalar = {
    id?: boolean
    organisationId?: boolean
    code?: boolean
    name?: boolean
    description?: boolean
    isActive?: boolean
    createdAt?: boolean
  }

  export type PurposeOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "organisationId" | "code" | "name" | "description" | "isActive" | "createdAt", ExtArgs["result"]["purpose"]>
  export type PurposeInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    organisation?: boolean | OrganisationDefaultArgs<ExtArgs>
    noticePurposes?: boolean | Purpose$noticePurposesArgs<ExtArgs>
    consentRecords?: boolean | Purpose$consentRecordsArgs<ExtArgs>
    _count?: boolean | PurposeCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type PurposeIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    organisation?: boolean | OrganisationDefaultArgs<ExtArgs>
  }
  export type PurposeIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    organisation?: boolean | OrganisationDefaultArgs<ExtArgs>
  }

  export type $PurposePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Purpose"
    objects: {
      organisation: Prisma.$OrganisationPayload<ExtArgs>
      noticePurposes: Prisma.$NoticePurposePayload<ExtArgs>[]
      consentRecords: Prisma.$ConsentRecordPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      organisationId: string
      code: string
      name: string
      description: string
      isActive: boolean
      createdAt: Date
    }, ExtArgs["result"]["purpose"]>
    composites: {}
  }

  type PurposeGetPayload<S extends boolean | null | undefined | PurposeDefaultArgs> = $Result.GetResult<Prisma.$PurposePayload, S>

  type PurposeCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<PurposeFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PurposeCountAggregateInputType | true
    }

  export interface PurposeDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Purpose'], meta: { name: 'Purpose' } }
    /**
     * Find zero or one Purpose that matches the filter.
     * @param {PurposeFindUniqueArgs} args - Arguments to find a Purpose
     * @example
     * // Get one Purpose
     * const purpose = await prisma.purpose.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PurposeFindUniqueArgs>(args: SelectSubset<T, PurposeFindUniqueArgs<ExtArgs>>): Prisma__PurposeClient<$Result.GetResult<Prisma.$PurposePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Purpose that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PurposeFindUniqueOrThrowArgs} args - Arguments to find a Purpose
     * @example
     * // Get one Purpose
     * const purpose = await prisma.purpose.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PurposeFindUniqueOrThrowArgs>(args: SelectSubset<T, PurposeFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PurposeClient<$Result.GetResult<Prisma.$PurposePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Purpose that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PurposeFindFirstArgs} args - Arguments to find a Purpose
     * @example
     * // Get one Purpose
     * const purpose = await prisma.purpose.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PurposeFindFirstArgs>(args?: SelectSubset<T, PurposeFindFirstArgs<ExtArgs>>): Prisma__PurposeClient<$Result.GetResult<Prisma.$PurposePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Purpose that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PurposeFindFirstOrThrowArgs} args - Arguments to find a Purpose
     * @example
     * // Get one Purpose
     * const purpose = await prisma.purpose.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PurposeFindFirstOrThrowArgs>(args?: SelectSubset<T, PurposeFindFirstOrThrowArgs<ExtArgs>>): Prisma__PurposeClient<$Result.GetResult<Prisma.$PurposePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Purposes that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PurposeFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Purposes
     * const purposes = await prisma.purpose.findMany()
     * 
     * // Get first 10 Purposes
     * const purposes = await prisma.purpose.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const purposeWithIdOnly = await prisma.purpose.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PurposeFindManyArgs>(args?: SelectSubset<T, PurposeFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PurposePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Purpose.
     * @param {PurposeCreateArgs} args - Arguments to create a Purpose.
     * @example
     * // Create one Purpose
     * const Purpose = await prisma.purpose.create({
     *   data: {
     *     // ... data to create a Purpose
     *   }
     * })
     * 
     */
    create<T extends PurposeCreateArgs>(args: SelectSubset<T, PurposeCreateArgs<ExtArgs>>): Prisma__PurposeClient<$Result.GetResult<Prisma.$PurposePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Purposes.
     * @param {PurposeCreateManyArgs} args - Arguments to create many Purposes.
     * @example
     * // Create many Purposes
     * const purpose = await prisma.purpose.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PurposeCreateManyArgs>(args?: SelectSubset<T, PurposeCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Purposes and returns the data saved in the database.
     * @param {PurposeCreateManyAndReturnArgs} args - Arguments to create many Purposes.
     * @example
     * // Create many Purposes
     * const purpose = await prisma.purpose.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Purposes and only return the `id`
     * const purposeWithIdOnly = await prisma.purpose.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PurposeCreateManyAndReturnArgs>(args?: SelectSubset<T, PurposeCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PurposePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Purpose.
     * @param {PurposeDeleteArgs} args - Arguments to delete one Purpose.
     * @example
     * // Delete one Purpose
     * const Purpose = await prisma.purpose.delete({
     *   where: {
     *     // ... filter to delete one Purpose
     *   }
     * })
     * 
     */
    delete<T extends PurposeDeleteArgs>(args: SelectSubset<T, PurposeDeleteArgs<ExtArgs>>): Prisma__PurposeClient<$Result.GetResult<Prisma.$PurposePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Purpose.
     * @param {PurposeUpdateArgs} args - Arguments to update one Purpose.
     * @example
     * // Update one Purpose
     * const purpose = await prisma.purpose.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PurposeUpdateArgs>(args: SelectSubset<T, PurposeUpdateArgs<ExtArgs>>): Prisma__PurposeClient<$Result.GetResult<Prisma.$PurposePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Purposes.
     * @param {PurposeDeleteManyArgs} args - Arguments to filter Purposes to delete.
     * @example
     * // Delete a few Purposes
     * const { count } = await prisma.purpose.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PurposeDeleteManyArgs>(args?: SelectSubset<T, PurposeDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Purposes.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PurposeUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Purposes
     * const purpose = await prisma.purpose.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PurposeUpdateManyArgs>(args: SelectSubset<T, PurposeUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Purposes and returns the data updated in the database.
     * @param {PurposeUpdateManyAndReturnArgs} args - Arguments to update many Purposes.
     * @example
     * // Update many Purposes
     * const purpose = await prisma.purpose.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Purposes and only return the `id`
     * const purposeWithIdOnly = await prisma.purpose.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends PurposeUpdateManyAndReturnArgs>(args: SelectSubset<T, PurposeUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PurposePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Purpose.
     * @param {PurposeUpsertArgs} args - Arguments to update or create a Purpose.
     * @example
     * // Update or create a Purpose
     * const purpose = await prisma.purpose.upsert({
     *   create: {
     *     // ... data to create a Purpose
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Purpose we want to update
     *   }
     * })
     */
    upsert<T extends PurposeUpsertArgs>(args: SelectSubset<T, PurposeUpsertArgs<ExtArgs>>): Prisma__PurposeClient<$Result.GetResult<Prisma.$PurposePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Purposes.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PurposeCountArgs} args - Arguments to filter Purposes to count.
     * @example
     * // Count the number of Purposes
     * const count = await prisma.purpose.count({
     *   where: {
     *     // ... the filter for the Purposes we want to count
     *   }
     * })
    **/
    count<T extends PurposeCountArgs>(
      args?: Subset<T, PurposeCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PurposeCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Purpose.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PurposeAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PurposeAggregateArgs>(args: Subset<T, PurposeAggregateArgs>): Prisma.PrismaPromise<GetPurposeAggregateType<T>>

    /**
     * Group by Purpose.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PurposeGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PurposeGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PurposeGroupByArgs['orderBy'] }
        : { orderBy?: PurposeGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PurposeGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPurposeGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Purpose model
   */
  readonly fields: PurposeFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Purpose.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PurposeClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    organisation<T extends OrganisationDefaultArgs<ExtArgs> = {}>(args?: Subset<T, OrganisationDefaultArgs<ExtArgs>>): Prisma__OrganisationClient<$Result.GetResult<Prisma.$OrganisationPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    noticePurposes<T extends Purpose$noticePurposesArgs<ExtArgs> = {}>(args?: Subset<T, Purpose$noticePurposesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$NoticePurposePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    consentRecords<T extends Purpose$consentRecordsArgs<ExtArgs> = {}>(args?: Subset<T, Purpose$consentRecordsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ConsentRecordPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Purpose model
   */
  interface PurposeFieldRefs {
    readonly id: FieldRef<"Purpose", 'String'>
    readonly organisationId: FieldRef<"Purpose", 'String'>
    readonly code: FieldRef<"Purpose", 'String'>
    readonly name: FieldRef<"Purpose", 'String'>
    readonly description: FieldRef<"Purpose", 'String'>
    readonly isActive: FieldRef<"Purpose", 'Boolean'>
    readonly createdAt: FieldRef<"Purpose", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Purpose findUnique
   */
  export type PurposeFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Purpose
     */
    select?: PurposeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Purpose
     */
    omit?: PurposeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PurposeInclude<ExtArgs> | null
    /**
     * Filter, which Purpose to fetch.
     */
    where: PurposeWhereUniqueInput
  }

  /**
   * Purpose findUniqueOrThrow
   */
  export type PurposeFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Purpose
     */
    select?: PurposeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Purpose
     */
    omit?: PurposeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PurposeInclude<ExtArgs> | null
    /**
     * Filter, which Purpose to fetch.
     */
    where: PurposeWhereUniqueInput
  }

  /**
   * Purpose findFirst
   */
  export type PurposeFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Purpose
     */
    select?: PurposeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Purpose
     */
    omit?: PurposeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PurposeInclude<ExtArgs> | null
    /**
     * Filter, which Purpose to fetch.
     */
    where?: PurposeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Purposes to fetch.
     */
    orderBy?: PurposeOrderByWithRelationInput | PurposeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Purposes.
     */
    cursor?: PurposeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Purposes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Purposes.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Purposes.
     */
    distinct?: PurposeScalarFieldEnum | PurposeScalarFieldEnum[]
  }

  /**
   * Purpose findFirstOrThrow
   */
  export type PurposeFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Purpose
     */
    select?: PurposeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Purpose
     */
    omit?: PurposeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PurposeInclude<ExtArgs> | null
    /**
     * Filter, which Purpose to fetch.
     */
    where?: PurposeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Purposes to fetch.
     */
    orderBy?: PurposeOrderByWithRelationInput | PurposeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Purposes.
     */
    cursor?: PurposeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Purposes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Purposes.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Purposes.
     */
    distinct?: PurposeScalarFieldEnum | PurposeScalarFieldEnum[]
  }

  /**
   * Purpose findMany
   */
  export type PurposeFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Purpose
     */
    select?: PurposeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Purpose
     */
    omit?: PurposeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PurposeInclude<ExtArgs> | null
    /**
     * Filter, which Purposes to fetch.
     */
    where?: PurposeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Purposes to fetch.
     */
    orderBy?: PurposeOrderByWithRelationInput | PurposeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Purposes.
     */
    cursor?: PurposeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Purposes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Purposes.
     */
    skip?: number
    distinct?: PurposeScalarFieldEnum | PurposeScalarFieldEnum[]
  }

  /**
   * Purpose create
   */
  export type PurposeCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Purpose
     */
    select?: PurposeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Purpose
     */
    omit?: PurposeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PurposeInclude<ExtArgs> | null
    /**
     * The data needed to create a Purpose.
     */
    data: XOR<PurposeCreateInput, PurposeUncheckedCreateInput>
  }

  /**
   * Purpose createMany
   */
  export type PurposeCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Purposes.
     */
    data: PurposeCreateManyInput | PurposeCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Purpose createManyAndReturn
   */
  export type PurposeCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Purpose
     */
    select?: PurposeSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Purpose
     */
    omit?: PurposeOmit<ExtArgs> | null
    /**
     * The data used to create many Purposes.
     */
    data: PurposeCreateManyInput | PurposeCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PurposeIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Purpose update
   */
  export type PurposeUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Purpose
     */
    select?: PurposeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Purpose
     */
    omit?: PurposeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PurposeInclude<ExtArgs> | null
    /**
     * The data needed to update a Purpose.
     */
    data: XOR<PurposeUpdateInput, PurposeUncheckedUpdateInput>
    /**
     * Choose, which Purpose to update.
     */
    where: PurposeWhereUniqueInput
  }

  /**
   * Purpose updateMany
   */
  export type PurposeUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Purposes.
     */
    data: XOR<PurposeUpdateManyMutationInput, PurposeUncheckedUpdateManyInput>
    /**
     * Filter which Purposes to update
     */
    where?: PurposeWhereInput
    /**
     * Limit how many Purposes to update.
     */
    limit?: number
  }

  /**
   * Purpose updateManyAndReturn
   */
  export type PurposeUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Purpose
     */
    select?: PurposeSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Purpose
     */
    omit?: PurposeOmit<ExtArgs> | null
    /**
     * The data used to update Purposes.
     */
    data: XOR<PurposeUpdateManyMutationInput, PurposeUncheckedUpdateManyInput>
    /**
     * Filter which Purposes to update
     */
    where?: PurposeWhereInput
    /**
     * Limit how many Purposes to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PurposeIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Purpose upsert
   */
  export type PurposeUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Purpose
     */
    select?: PurposeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Purpose
     */
    omit?: PurposeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PurposeInclude<ExtArgs> | null
    /**
     * The filter to search for the Purpose to update in case it exists.
     */
    where: PurposeWhereUniqueInput
    /**
     * In case the Purpose found by the `where` argument doesn't exist, create a new Purpose with this data.
     */
    create: XOR<PurposeCreateInput, PurposeUncheckedCreateInput>
    /**
     * In case the Purpose was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PurposeUpdateInput, PurposeUncheckedUpdateInput>
  }

  /**
   * Purpose delete
   */
  export type PurposeDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Purpose
     */
    select?: PurposeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Purpose
     */
    omit?: PurposeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PurposeInclude<ExtArgs> | null
    /**
     * Filter which Purpose to delete.
     */
    where: PurposeWhereUniqueInput
  }

  /**
   * Purpose deleteMany
   */
  export type PurposeDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Purposes to delete
     */
    where?: PurposeWhereInput
    /**
     * Limit how many Purposes to delete.
     */
    limit?: number
  }

  /**
   * Purpose.noticePurposes
   */
  export type Purpose$noticePurposesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the NoticePurpose
     */
    select?: NoticePurposeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the NoticePurpose
     */
    omit?: NoticePurposeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: NoticePurposeInclude<ExtArgs> | null
    where?: NoticePurposeWhereInput
    orderBy?: NoticePurposeOrderByWithRelationInput | NoticePurposeOrderByWithRelationInput[]
    cursor?: NoticePurposeWhereUniqueInput
    take?: number
    skip?: number
    distinct?: NoticePurposeScalarFieldEnum | NoticePurposeScalarFieldEnum[]
  }

  /**
   * Purpose.consentRecords
   */
  export type Purpose$consentRecordsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConsentRecord
     */
    select?: ConsentRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ConsentRecord
     */
    omit?: ConsentRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConsentRecordInclude<ExtArgs> | null
    where?: ConsentRecordWhereInput
    orderBy?: ConsentRecordOrderByWithRelationInput | ConsentRecordOrderByWithRelationInput[]
    cursor?: ConsentRecordWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ConsentRecordScalarFieldEnum | ConsentRecordScalarFieldEnum[]
  }

  /**
   * Purpose without action
   */
  export type PurposeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Purpose
     */
    select?: PurposeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Purpose
     */
    omit?: PurposeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PurposeInclude<ExtArgs> | null
  }


  /**
   * Model Policy
   */

  export type AggregatePolicy = {
    _count: PolicyCountAggregateOutputType | null
    _min: PolicyMinAggregateOutputType | null
    _max: PolicyMaxAggregateOutputType | null
  }

  export type PolicyMinAggregateOutputType = {
    id: string | null
    organisationId: string | null
    code: string | null
    name: string | null
    createdAt: Date | null
  }

  export type PolicyMaxAggregateOutputType = {
    id: string | null
    organisationId: string | null
    code: string | null
    name: string | null
    createdAt: Date | null
  }

  export type PolicyCountAggregateOutputType = {
    id: number
    organisationId: number
    code: number
    name: number
    createdAt: number
    _all: number
  }


  export type PolicyMinAggregateInputType = {
    id?: true
    organisationId?: true
    code?: true
    name?: true
    createdAt?: true
  }

  export type PolicyMaxAggregateInputType = {
    id?: true
    organisationId?: true
    code?: true
    name?: true
    createdAt?: true
  }

  export type PolicyCountAggregateInputType = {
    id?: true
    organisationId?: true
    code?: true
    name?: true
    createdAt?: true
    _all?: true
  }

  export type PolicyAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Policy to aggregate.
     */
    where?: PolicyWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Policies to fetch.
     */
    orderBy?: PolicyOrderByWithRelationInput | PolicyOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PolicyWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Policies from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Policies.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Policies
    **/
    _count?: true | PolicyCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PolicyMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PolicyMaxAggregateInputType
  }

  export type GetPolicyAggregateType<T extends PolicyAggregateArgs> = {
        [P in keyof T & keyof AggregatePolicy]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePolicy[P]>
      : GetScalarType<T[P], AggregatePolicy[P]>
  }




  export type PolicyGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PolicyWhereInput
    orderBy?: PolicyOrderByWithAggregationInput | PolicyOrderByWithAggregationInput[]
    by: PolicyScalarFieldEnum[] | PolicyScalarFieldEnum
    having?: PolicyScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PolicyCountAggregateInputType | true
    _min?: PolicyMinAggregateInputType
    _max?: PolicyMaxAggregateInputType
  }

  export type PolicyGroupByOutputType = {
    id: string
    organisationId: string
    code: string
    name: string
    createdAt: Date
    _count: PolicyCountAggregateOutputType | null
    _min: PolicyMinAggregateOutputType | null
    _max: PolicyMaxAggregateOutputType | null
  }

  type GetPolicyGroupByPayload<T extends PolicyGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PolicyGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PolicyGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PolicyGroupByOutputType[P]>
            : GetScalarType<T[P], PolicyGroupByOutputType[P]>
        }
      >
    >


  export type PolicySelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organisationId?: boolean
    code?: boolean
    name?: boolean
    createdAt?: boolean
    organisation?: boolean | OrganisationDefaultArgs<ExtArgs>
    versions?: boolean | Policy$versionsArgs<ExtArgs>
    _count?: boolean | PolicyCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["policy"]>

  export type PolicySelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organisationId?: boolean
    code?: boolean
    name?: boolean
    createdAt?: boolean
    organisation?: boolean | OrganisationDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["policy"]>

  export type PolicySelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organisationId?: boolean
    code?: boolean
    name?: boolean
    createdAt?: boolean
    organisation?: boolean | OrganisationDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["policy"]>

  export type PolicySelectScalar = {
    id?: boolean
    organisationId?: boolean
    code?: boolean
    name?: boolean
    createdAt?: boolean
  }

  export type PolicyOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "organisationId" | "code" | "name" | "createdAt", ExtArgs["result"]["policy"]>
  export type PolicyInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    organisation?: boolean | OrganisationDefaultArgs<ExtArgs>
    versions?: boolean | Policy$versionsArgs<ExtArgs>
    _count?: boolean | PolicyCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type PolicyIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    organisation?: boolean | OrganisationDefaultArgs<ExtArgs>
  }
  export type PolicyIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    organisation?: boolean | OrganisationDefaultArgs<ExtArgs>
  }

  export type $PolicyPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Policy"
    objects: {
      organisation: Prisma.$OrganisationPayload<ExtArgs>
      versions: Prisma.$PolicyVersionPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      organisationId: string
      code: string
      name: string
      createdAt: Date
    }, ExtArgs["result"]["policy"]>
    composites: {}
  }

  type PolicyGetPayload<S extends boolean | null | undefined | PolicyDefaultArgs> = $Result.GetResult<Prisma.$PolicyPayload, S>

  type PolicyCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<PolicyFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PolicyCountAggregateInputType | true
    }

  export interface PolicyDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Policy'], meta: { name: 'Policy' } }
    /**
     * Find zero or one Policy that matches the filter.
     * @param {PolicyFindUniqueArgs} args - Arguments to find a Policy
     * @example
     * // Get one Policy
     * const policy = await prisma.policy.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PolicyFindUniqueArgs>(args: SelectSubset<T, PolicyFindUniqueArgs<ExtArgs>>): Prisma__PolicyClient<$Result.GetResult<Prisma.$PolicyPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Policy that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PolicyFindUniqueOrThrowArgs} args - Arguments to find a Policy
     * @example
     * // Get one Policy
     * const policy = await prisma.policy.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PolicyFindUniqueOrThrowArgs>(args: SelectSubset<T, PolicyFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PolicyClient<$Result.GetResult<Prisma.$PolicyPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Policy that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PolicyFindFirstArgs} args - Arguments to find a Policy
     * @example
     * // Get one Policy
     * const policy = await prisma.policy.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PolicyFindFirstArgs>(args?: SelectSubset<T, PolicyFindFirstArgs<ExtArgs>>): Prisma__PolicyClient<$Result.GetResult<Prisma.$PolicyPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Policy that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PolicyFindFirstOrThrowArgs} args - Arguments to find a Policy
     * @example
     * // Get one Policy
     * const policy = await prisma.policy.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PolicyFindFirstOrThrowArgs>(args?: SelectSubset<T, PolicyFindFirstOrThrowArgs<ExtArgs>>): Prisma__PolicyClient<$Result.GetResult<Prisma.$PolicyPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Policies that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PolicyFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Policies
     * const policies = await prisma.policy.findMany()
     * 
     * // Get first 10 Policies
     * const policies = await prisma.policy.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const policyWithIdOnly = await prisma.policy.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PolicyFindManyArgs>(args?: SelectSubset<T, PolicyFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PolicyPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Policy.
     * @param {PolicyCreateArgs} args - Arguments to create a Policy.
     * @example
     * // Create one Policy
     * const Policy = await prisma.policy.create({
     *   data: {
     *     // ... data to create a Policy
     *   }
     * })
     * 
     */
    create<T extends PolicyCreateArgs>(args: SelectSubset<T, PolicyCreateArgs<ExtArgs>>): Prisma__PolicyClient<$Result.GetResult<Prisma.$PolicyPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Policies.
     * @param {PolicyCreateManyArgs} args - Arguments to create many Policies.
     * @example
     * // Create many Policies
     * const policy = await prisma.policy.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PolicyCreateManyArgs>(args?: SelectSubset<T, PolicyCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Policies and returns the data saved in the database.
     * @param {PolicyCreateManyAndReturnArgs} args - Arguments to create many Policies.
     * @example
     * // Create many Policies
     * const policy = await prisma.policy.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Policies and only return the `id`
     * const policyWithIdOnly = await prisma.policy.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PolicyCreateManyAndReturnArgs>(args?: SelectSubset<T, PolicyCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PolicyPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Policy.
     * @param {PolicyDeleteArgs} args - Arguments to delete one Policy.
     * @example
     * // Delete one Policy
     * const Policy = await prisma.policy.delete({
     *   where: {
     *     // ... filter to delete one Policy
     *   }
     * })
     * 
     */
    delete<T extends PolicyDeleteArgs>(args: SelectSubset<T, PolicyDeleteArgs<ExtArgs>>): Prisma__PolicyClient<$Result.GetResult<Prisma.$PolicyPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Policy.
     * @param {PolicyUpdateArgs} args - Arguments to update one Policy.
     * @example
     * // Update one Policy
     * const policy = await prisma.policy.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PolicyUpdateArgs>(args: SelectSubset<T, PolicyUpdateArgs<ExtArgs>>): Prisma__PolicyClient<$Result.GetResult<Prisma.$PolicyPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Policies.
     * @param {PolicyDeleteManyArgs} args - Arguments to filter Policies to delete.
     * @example
     * // Delete a few Policies
     * const { count } = await prisma.policy.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PolicyDeleteManyArgs>(args?: SelectSubset<T, PolicyDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Policies.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PolicyUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Policies
     * const policy = await prisma.policy.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PolicyUpdateManyArgs>(args: SelectSubset<T, PolicyUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Policies and returns the data updated in the database.
     * @param {PolicyUpdateManyAndReturnArgs} args - Arguments to update many Policies.
     * @example
     * // Update many Policies
     * const policy = await prisma.policy.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Policies and only return the `id`
     * const policyWithIdOnly = await prisma.policy.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends PolicyUpdateManyAndReturnArgs>(args: SelectSubset<T, PolicyUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PolicyPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Policy.
     * @param {PolicyUpsertArgs} args - Arguments to update or create a Policy.
     * @example
     * // Update or create a Policy
     * const policy = await prisma.policy.upsert({
     *   create: {
     *     // ... data to create a Policy
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Policy we want to update
     *   }
     * })
     */
    upsert<T extends PolicyUpsertArgs>(args: SelectSubset<T, PolicyUpsertArgs<ExtArgs>>): Prisma__PolicyClient<$Result.GetResult<Prisma.$PolicyPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Policies.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PolicyCountArgs} args - Arguments to filter Policies to count.
     * @example
     * // Count the number of Policies
     * const count = await prisma.policy.count({
     *   where: {
     *     // ... the filter for the Policies we want to count
     *   }
     * })
    **/
    count<T extends PolicyCountArgs>(
      args?: Subset<T, PolicyCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PolicyCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Policy.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PolicyAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PolicyAggregateArgs>(args: Subset<T, PolicyAggregateArgs>): Prisma.PrismaPromise<GetPolicyAggregateType<T>>

    /**
     * Group by Policy.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PolicyGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PolicyGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PolicyGroupByArgs['orderBy'] }
        : { orderBy?: PolicyGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PolicyGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPolicyGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Policy model
   */
  readonly fields: PolicyFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Policy.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PolicyClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    organisation<T extends OrganisationDefaultArgs<ExtArgs> = {}>(args?: Subset<T, OrganisationDefaultArgs<ExtArgs>>): Prisma__OrganisationClient<$Result.GetResult<Prisma.$OrganisationPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    versions<T extends Policy$versionsArgs<ExtArgs> = {}>(args?: Subset<T, Policy$versionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PolicyVersionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Policy model
   */
  interface PolicyFieldRefs {
    readonly id: FieldRef<"Policy", 'String'>
    readonly organisationId: FieldRef<"Policy", 'String'>
    readonly code: FieldRef<"Policy", 'String'>
    readonly name: FieldRef<"Policy", 'String'>
    readonly createdAt: FieldRef<"Policy", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Policy findUnique
   */
  export type PolicyFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Policy
     */
    select?: PolicySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Policy
     */
    omit?: PolicyOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PolicyInclude<ExtArgs> | null
    /**
     * Filter, which Policy to fetch.
     */
    where: PolicyWhereUniqueInput
  }

  /**
   * Policy findUniqueOrThrow
   */
  export type PolicyFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Policy
     */
    select?: PolicySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Policy
     */
    omit?: PolicyOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PolicyInclude<ExtArgs> | null
    /**
     * Filter, which Policy to fetch.
     */
    where: PolicyWhereUniqueInput
  }

  /**
   * Policy findFirst
   */
  export type PolicyFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Policy
     */
    select?: PolicySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Policy
     */
    omit?: PolicyOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PolicyInclude<ExtArgs> | null
    /**
     * Filter, which Policy to fetch.
     */
    where?: PolicyWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Policies to fetch.
     */
    orderBy?: PolicyOrderByWithRelationInput | PolicyOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Policies.
     */
    cursor?: PolicyWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Policies from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Policies.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Policies.
     */
    distinct?: PolicyScalarFieldEnum | PolicyScalarFieldEnum[]
  }

  /**
   * Policy findFirstOrThrow
   */
  export type PolicyFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Policy
     */
    select?: PolicySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Policy
     */
    omit?: PolicyOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PolicyInclude<ExtArgs> | null
    /**
     * Filter, which Policy to fetch.
     */
    where?: PolicyWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Policies to fetch.
     */
    orderBy?: PolicyOrderByWithRelationInput | PolicyOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Policies.
     */
    cursor?: PolicyWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Policies from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Policies.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Policies.
     */
    distinct?: PolicyScalarFieldEnum | PolicyScalarFieldEnum[]
  }

  /**
   * Policy findMany
   */
  export type PolicyFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Policy
     */
    select?: PolicySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Policy
     */
    omit?: PolicyOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PolicyInclude<ExtArgs> | null
    /**
     * Filter, which Policies to fetch.
     */
    where?: PolicyWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Policies to fetch.
     */
    orderBy?: PolicyOrderByWithRelationInput | PolicyOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Policies.
     */
    cursor?: PolicyWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Policies from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Policies.
     */
    skip?: number
    distinct?: PolicyScalarFieldEnum | PolicyScalarFieldEnum[]
  }

  /**
   * Policy create
   */
  export type PolicyCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Policy
     */
    select?: PolicySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Policy
     */
    omit?: PolicyOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PolicyInclude<ExtArgs> | null
    /**
     * The data needed to create a Policy.
     */
    data: XOR<PolicyCreateInput, PolicyUncheckedCreateInput>
  }

  /**
   * Policy createMany
   */
  export type PolicyCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Policies.
     */
    data: PolicyCreateManyInput | PolicyCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Policy createManyAndReturn
   */
  export type PolicyCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Policy
     */
    select?: PolicySelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Policy
     */
    omit?: PolicyOmit<ExtArgs> | null
    /**
     * The data used to create many Policies.
     */
    data: PolicyCreateManyInput | PolicyCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PolicyIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Policy update
   */
  export type PolicyUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Policy
     */
    select?: PolicySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Policy
     */
    omit?: PolicyOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PolicyInclude<ExtArgs> | null
    /**
     * The data needed to update a Policy.
     */
    data: XOR<PolicyUpdateInput, PolicyUncheckedUpdateInput>
    /**
     * Choose, which Policy to update.
     */
    where: PolicyWhereUniqueInput
  }

  /**
   * Policy updateMany
   */
  export type PolicyUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Policies.
     */
    data: XOR<PolicyUpdateManyMutationInput, PolicyUncheckedUpdateManyInput>
    /**
     * Filter which Policies to update
     */
    where?: PolicyWhereInput
    /**
     * Limit how many Policies to update.
     */
    limit?: number
  }

  /**
   * Policy updateManyAndReturn
   */
  export type PolicyUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Policy
     */
    select?: PolicySelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Policy
     */
    omit?: PolicyOmit<ExtArgs> | null
    /**
     * The data used to update Policies.
     */
    data: XOR<PolicyUpdateManyMutationInput, PolicyUncheckedUpdateManyInput>
    /**
     * Filter which Policies to update
     */
    where?: PolicyWhereInput
    /**
     * Limit how many Policies to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PolicyIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Policy upsert
   */
  export type PolicyUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Policy
     */
    select?: PolicySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Policy
     */
    omit?: PolicyOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PolicyInclude<ExtArgs> | null
    /**
     * The filter to search for the Policy to update in case it exists.
     */
    where: PolicyWhereUniqueInput
    /**
     * In case the Policy found by the `where` argument doesn't exist, create a new Policy with this data.
     */
    create: XOR<PolicyCreateInput, PolicyUncheckedCreateInput>
    /**
     * In case the Policy was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PolicyUpdateInput, PolicyUncheckedUpdateInput>
  }

  /**
   * Policy delete
   */
  export type PolicyDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Policy
     */
    select?: PolicySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Policy
     */
    omit?: PolicyOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PolicyInclude<ExtArgs> | null
    /**
     * Filter which Policy to delete.
     */
    where: PolicyWhereUniqueInput
  }

  /**
   * Policy deleteMany
   */
  export type PolicyDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Policies to delete
     */
    where?: PolicyWhereInput
    /**
     * Limit how many Policies to delete.
     */
    limit?: number
  }

  /**
   * Policy.versions
   */
  export type Policy$versionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PolicyVersion
     */
    select?: PolicyVersionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PolicyVersion
     */
    omit?: PolicyVersionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PolicyVersionInclude<ExtArgs> | null
    where?: PolicyVersionWhereInput
    orderBy?: PolicyVersionOrderByWithRelationInput | PolicyVersionOrderByWithRelationInput[]
    cursor?: PolicyVersionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PolicyVersionScalarFieldEnum | PolicyVersionScalarFieldEnum[]
  }

  /**
   * Policy without action
   */
  export type PolicyDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Policy
     */
    select?: PolicySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Policy
     */
    omit?: PolicyOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PolicyInclude<ExtArgs> | null
  }


  /**
   * Model PolicyVersion
   */

  export type AggregatePolicyVersion = {
    _count: PolicyVersionCountAggregateOutputType | null
    _min: PolicyVersionMinAggregateOutputType | null
    _max: PolicyVersionMaxAggregateOutputType | null
  }

  export type PolicyVersionMinAggregateOutputType = {
    id: string | null
    organisationId: string | null
    policyId: string | null
    version: string | null
    documentUrl: string | null
    contentHash: string | null
    publishedAt: Date | null
  }

  export type PolicyVersionMaxAggregateOutputType = {
    id: string | null
    organisationId: string | null
    policyId: string | null
    version: string | null
    documentUrl: string | null
    contentHash: string | null
    publishedAt: Date | null
  }

  export type PolicyVersionCountAggregateOutputType = {
    id: number
    organisationId: number
    policyId: number
    version: number
    documentUrl: number
    contentHash: number
    publishedAt: number
    _all: number
  }


  export type PolicyVersionMinAggregateInputType = {
    id?: true
    organisationId?: true
    policyId?: true
    version?: true
    documentUrl?: true
    contentHash?: true
    publishedAt?: true
  }

  export type PolicyVersionMaxAggregateInputType = {
    id?: true
    organisationId?: true
    policyId?: true
    version?: true
    documentUrl?: true
    contentHash?: true
    publishedAt?: true
  }

  export type PolicyVersionCountAggregateInputType = {
    id?: true
    organisationId?: true
    policyId?: true
    version?: true
    documentUrl?: true
    contentHash?: true
    publishedAt?: true
    _all?: true
  }

  export type PolicyVersionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PolicyVersion to aggregate.
     */
    where?: PolicyVersionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PolicyVersions to fetch.
     */
    orderBy?: PolicyVersionOrderByWithRelationInput | PolicyVersionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PolicyVersionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PolicyVersions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PolicyVersions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PolicyVersions
    **/
    _count?: true | PolicyVersionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PolicyVersionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PolicyVersionMaxAggregateInputType
  }

  export type GetPolicyVersionAggregateType<T extends PolicyVersionAggregateArgs> = {
        [P in keyof T & keyof AggregatePolicyVersion]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePolicyVersion[P]>
      : GetScalarType<T[P], AggregatePolicyVersion[P]>
  }




  export type PolicyVersionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PolicyVersionWhereInput
    orderBy?: PolicyVersionOrderByWithAggregationInput | PolicyVersionOrderByWithAggregationInput[]
    by: PolicyVersionScalarFieldEnum[] | PolicyVersionScalarFieldEnum
    having?: PolicyVersionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PolicyVersionCountAggregateInputType | true
    _min?: PolicyVersionMinAggregateInputType
    _max?: PolicyVersionMaxAggregateInputType
  }

  export type PolicyVersionGroupByOutputType = {
    id: string
    organisationId: string
    policyId: string
    version: string
    documentUrl: string | null
    contentHash: string | null
    publishedAt: Date
    _count: PolicyVersionCountAggregateOutputType | null
    _min: PolicyVersionMinAggregateOutputType | null
    _max: PolicyVersionMaxAggregateOutputType | null
  }

  type GetPolicyVersionGroupByPayload<T extends PolicyVersionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PolicyVersionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PolicyVersionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PolicyVersionGroupByOutputType[P]>
            : GetScalarType<T[P], PolicyVersionGroupByOutputType[P]>
        }
      >
    >


  export type PolicyVersionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organisationId?: boolean
    policyId?: boolean
    version?: boolean
    documentUrl?: boolean
    contentHash?: boolean
    publishedAt?: boolean
    policy?: boolean | PolicyDefaultArgs<ExtArgs>
    notices?: boolean | PolicyVersion$noticesArgs<ExtArgs>
    consentRecords?: boolean | PolicyVersion$consentRecordsArgs<ExtArgs>
    _count?: boolean | PolicyVersionCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["policyVersion"]>

  export type PolicyVersionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organisationId?: boolean
    policyId?: boolean
    version?: boolean
    documentUrl?: boolean
    contentHash?: boolean
    publishedAt?: boolean
    policy?: boolean | PolicyDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["policyVersion"]>

  export type PolicyVersionSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organisationId?: boolean
    policyId?: boolean
    version?: boolean
    documentUrl?: boolean
    contentHash?: boolean
    publishedAt?: boolean
    policy?: boolean | PolicyDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["policyVersion"]>

  export type PolicyVersionSelectScalar = {
    id?: boolean
    organisationId?: boolean
    policyId?: boolean
    version?: boolean
    documentUrl?: boolean
    contentHash?: boolean
    publishedAt?: boolean
  }

  export type PolicyVersionOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "organisationId" | "policyId" | "version" | "documentUrl" | "contentHash" | "publishedAt", ExtArgs["result"]["policyVersion"]>
  export type PolicyVersionInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    policy?: boolean | PolicyDefaultArgs<ExtArgs>
    notices?: boolean | PolicyVersion$noticesArgs<ExtArgs>
    consentRecords?: boolean | PolicyVersion$consentRecordsArgs<ExtArgs>
    _count?: boolean | PolicyVersionCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type PolicyVersionIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    policy?: boolean | PolicyDefaultArgs<ExtArgs>
  }
  export type PolicyVersionIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    policy?: boolean | PolicyDefaultArgs<ExtArgs>
  }

  export type $PolicyVersionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PolicyVersion"
    objects: {
      policy: Prisma.$PolicyPayload<ExtArgs>
      notices: Prisma.$NoticePayload<ExtArgs>[]
      consentRecords: Prisma.$ConsentRecordPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      organisationId: string
      policyId: string
      version: string
      documentUrl: string | null
      /**
       * Digest of the published text, so a stored version can be proven unchanged.
       */
      contentHash: string | null
      publishedAt: Date
    }, ExtArgs["result"]["policyVersion"]>
    composites: {}
  }

  type PolicyVersionGetPayload<S extends boolean | null | undefined | PolicyVersionDefaultArgs> = $Result.GetResult<Prisma.$PolicyVersionPayload, S>

  type PolicyVersionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<PolicyVersionFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PolicyVersionCountAggregateInputType | true
    }

  export interface PolicyVersionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PolicyVersion'], meta: { name: 'PolicyVersion' } }
    /**
     * Find zero or one PolicyVersion that matches the filter.
     * @param {PolicyVersionFindUniqueArgs} args - Arguments to find a PolicyVersion
     * @example
     * // Get one PolicyVersion
     * const policyVersion = await prisma.policyVersion.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PolicyVersionFindUniqueArgs>(args: SelectSubset<T, PolicyVersionFindUniqueArgs<ExtArgs>>): Prisma__PolicyVersionClient<$Result.GetResult<Prisma.$PolicyVersionPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one PolicyVersion that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PolicyVersionFindUniqueOrThrowArgs} args - Arguments to find a PolicyVersion
     * @example
     * // Get one PolicyVersion
     * const policyVersion = await prisma.policyVersion.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PolicyVersionFindUniqueOrThrowArgs>(args: SelectSubset<T, PolicyVersionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PolicyVersionClient<$Result.GetResult<Prisma.$PolicyVersionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PolicyVersion that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PolicyVersionFindFirstArgs} args - Arguments to find a PolicyVersion
     * @example
     * // Get one PolicyVersion
     * const policyVersion = await prisma.policyVersion.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PolicyVersionFindFirstArgs>(args?: SelectSubset<T, PolicyVersionFindFirstArgs<ExtArgs>>): Prisma__PolicyVersionClient<$Result.GetResult<Prisma.$PolicyVersionPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PolicyVersion that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PolicyVersionFindFirstOrThrowArgs} args - Arguments to find a PolicyVersion
     * @example
     * // Get one PolicyVersion
     * const policyVersion = await prisma.policyVersion.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PolicyVersionFindFirstOrThrowArgs>(args?: SelectSubset<T, PolicyVersionFindFirstOrThrowArgs<ExtArgs>>): Prisma__PolicyVersionClient<$Result.GetResult<Prisma.$PolicyVersionPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more PolicyVersions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PolicyVersionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PolicyVersions
     * const policyVersions = await prisma.policyVersion.findMany()
     * 
     * // Get first 10 PolicyVersions
     * const policyVersions = await prisma.policyVersion.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const policyVersionWithIdOnly = await prisma.policyVersion.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PolicyVersionFindManyArgs>(args?: SelectSubset<T, PolicyVersionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PolicyVersionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a PolicyVersion.
     * @param {PolicyVersionCreateArgs} args - Arguments to create a PolicyVersion.
     * @example
     * // Create one PolicyVersion
     * const PolicyVersion = await prisma.policyVersion.create({
     *   data: {
     *     // ... data to create a PolicyVersion
     *   }
     * })
     * 
     */
    create<T extends PolicyVersionCreateArgs>(args: SelectSubset<T, PolicyVersionCreateArgs<ExtArgs>>): Prisma__PolicyVersionClient<$Result.GetResult<Prisma.$PolicyVersionPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many PolicyVersions.
     * @param {PolicyVersionCreateManyArgs} args - Arguments to create many PolicyVersions.
     * @example
     * // Create many PolicyVersions
     * const policyVersion = await prisma.policyVersion.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PolicyVersionCreateManyArgs>(args?: SelectSubset<T, PolicyVersionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PolicyVersions and returns the data saved in the database.
     * @param {PolicyVersionCreateManyAndReturnArgs} args - Arguments to create many PolicyVersions.
     * @example
     * // Create many PolicyVersions
     * const policyVersion = await prisma.policyVersion.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PolicyVersions and only return the `id`
     * const policyVersionWithIdOnly = await prisma.policyVersion.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PolicyVersionCreateManyAndReturnArgs>(args?: SelectSubset<T, PolicyVersionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PolicyVersionPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a PolicyVersion.
     * @param {PolicyVersionDeleteArgs} args - Arguments to delete one PolicyVersion.
     * @example
     * // Delete one PolicyVersion
     * const PolicyVersion = await prisma.policyVersion.delete({
     *   where: {
     *     // ... filter to delete one PolicyVersion
     *   }
     * })
     * 
     */
    delete<T extends PolicyVersionDeleteArgs>(args: SelectSubset<T, PolicyVersionDeleteArgs<ExtArgs>>): Prisma__PolicyVersionClient<$Result.GetResult<Prisma.$PolicyVersionPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one PolicyVersion.
     * @param {PolicyVersionUpdateArgs} args - Arguments to update one PolicyVersion.
     * @example
     * // Update one PolicyVersion
     * const policyVersion = await prisma.policyVersion.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PolicyVersionUpdateArgs>(args: SelectSubset<T, PolicyVersionUpdateArgs<ExtArgs>>): Prisma__PolicyVersionClient<$Result.GetResult<Prisma.$PolicyVersionPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more PolicyVersions.
     * @param {PolicyVersionDeleteManyArgs} args - Arguments to filter PolicyVersions to delete.
     * @example
     * // Delete a few PolicyVersions
     * const { count } = await prisma.policyVersion.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PolicyVersionDeleteManyArgs>(args?: SelectSubset<T, PolicyVersionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PolicyVersions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PolicyVersionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PolicyVersions
     * const policyVersion = await prisma.policyVersion.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PolicyVersionUpdateManyArgs>(args: SelectSubset<T, PolicyVersionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PolicyVersions and returns the data updated in the database.
     * @param {PolicyVersionUpdateManyAndReturnArgs} args - Arguments to update many PolicyVersions.
     * @example
     * // Update many PolicyVersions
     * const policyVersion = await prisma.policyVersion.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more PolicyVersions and only return the `id`
     * const policyVersionWithIdOnly = await prisma.policyVersion.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends PolicyVersionUpdateManyAndReturnArgs>(args: SelectSubset<T, PolicyVersionUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PolicyVersionPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one PolicyVersion.
     * @param {PolicyVersionUpsertArgs} args - Arguments to update or create a PolicyVersion.
     * @example
     * // Update or create a PolicyVersion
     * const policyVersion = await prisma.policyVersion.upsert({
     *   create: {
     *     // ... data to create a PolicyVersion
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PolicyVersion we want to update
     *   }
     * })
     */
    upsert<T extends PolicyVersionUpsertArgs>(args: SelectSubset<T, PolicyVersionUpsertArgs<ExtArgs>>): Prisma__PolicyVersionClient<$Result.GetResult<Prisma.$PolicyVersionPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of PolicyVersions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PolicyVersionCountArgs} args - Arguments to filter PolicyVersions to count.
     * @example
     * // Count the number of PolicyVersions
     * const count = await prisma.policyVersion.count({
     *   where: {
     *     // ... the filter for the PolicyVersions we want to count
     *   }
     * })
    **/
    count<T extends PolicyVersionCountArgs>(
      args?: Subset<T, PolicyVersionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PolicyVersionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PolicyVersion.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PolicyVersionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PolicyVersionAggregateArgs>(args: Subset<T, PolicyVersionAggregateArgs>): Prisma.PrismaPromise<GetPolicyVersionAggregateType<T>>

    /**
     * Group by PolicyVersion.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PolicyVersionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PolicyVersionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PolicyVersionGroupByArgs['orderBy'] }
        : { orderBy?: PolicyVersionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PolicyVersionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPolicyVersionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PolicyVersion model
   */
  readonly fields: PolicyVersionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PolicyVersion.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PolicyVersionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    policy<T extends PolicyDefaultArgs<ExtArgs> = {}>(args?: Subset<T, PolicyDefaultArgs<ExtArgs>>): Prisma__PolicyClient<$Result.GetResult<Prisma.$PolicyPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    notices<T extends PolicyVersion$noticesArgs<ExtArgs> = {}>(args?: Subset<T, PolicyVersion$noticesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$NoticePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    consentRecords<T extends PolicyVersion$consentRecordsArgs<ExtArgs> = {}>(args?: Subset<T, PolicyVersion$consentRecordsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ConsentRecordPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PolicyVersion model
   */
  interface PolicyVersionFieldRefs {
    readonly id: FieldRef<"PolicyVersion", 'String'>
    readonly organisationId: FieldRef<"PolicyVersion", 'String'>
    readonly policyId: FieldRef<"PolicyVersion", 'String'>
    readonly version: FieldRef<"PolicyVersion", 'String'>
    readonly documentUrl: FieldRef<"PolicyVersion", 'String'>
    readonly contentHash: FieldRef<"PolicyVersion", 'String'>
    readonly publishedAt: FieldRef<"PolicyVersion", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * PolicyVersion findUnique
   */
  export type PolicyVersionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PolicyVersion
     */
    select?: PolicyVersionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PolicyVersion
     */
    omit?: PolicyVersionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PolicyVersionInclude<ExtArgs> | null
    /**
     * Filter, which PolicyVersion to fetch.
     */
    where: PolicyVersionWhereUniqueInput
  }

  /**
   * PolicyVersion findUniqueOrThrow
   */
  export type PolicyVersionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PolicyVersion
     */
    select?: PolicyVersionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PolicyVersion
     */
    omit?: PolicyVersionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PolicyVersionInclude<ExtArgs> | null
    /**
     * Filter, which PolicyVersion to fetch.
     */
    where: PolicyVersionWhereUniqueInput
  }

  /**
   * PolicyVersion findFirst
   */
  export type PolicyVersionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PolicyVersion
     */
    select?: PolicyVersionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PolicyVersion
     */
    omit?: PolicyVersionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PolicyVersionInclude<ExtArgs> | null
    /**
     * Filter, which PolicyVersion to fetch.
     */
    where?: PolicyVersionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PolicyVersions to fetch.
     */
    orderBy?: PolicyVersionOrderByWithRelationInput | PolicyVersionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PolicyVersions.
     */
    cursor?: PolicyVersionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PolicyVersions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PolicyVersions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PolicyVersions.
     */
    distinct?: PolicyVersionScalarFieldEnum | PolicyVersionScalarFieldEnum[]
  }

  /**
   * PolicyVersion findFirstOrThrow
   */
  export type PolicyVersionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PolicyVersion
     */
    select?: PolicyVersionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PolicyVersion
     */
    omit?: PolicyVersionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PolicyVersionInclude<ExtArgs> | null
    /**
     * Filter, which PolicyVersion to fetch.
     */
    where?: PolicyVersionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PolicyVersions to fetch.
     */
    orderBy?: PolicyVersionOrderByWithRelationInput | PolicyVersionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PolicyVersions.
     */
    cursor?: PolicyVersionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PolicyVersions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PolicyVersions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PolicyVersions.
     */
    distinct?: PolicyVersionScalarFieldEnum | PolicyVersionScalarFieldEnum[]
  }

  /**
   * PolicyVersion findMany
   */
  export type PolicyVersionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PolicyVersion
     */
    select?: PolicyVersionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PolicyVersion
     */
    omit?: PolicyVersionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PolicyVersionInclude<ExtArgs> | null
    /**
     * Filter, which PolicyVersions to fetch.
     */
    where?: PolicyVersionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PolicyVersions to fetch.
     */
    orderBy?: PolicyVersionOrderByWithRelationInput | PolicyVersionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PolicyVersions.
     */
    cursor?: PolicyVersionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PolicyVersions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PolicyVersions.
     */
    skip?: number
    distinct?: PolicyVersionScalarFieldEnum | PolicyVersionScalarFieldEnum[]
  }

  /**
   * PolicyVersion create
   */
  export type PolicyVersionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PolicyVersion
     */
    select?: PolicyVersionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PolicyVersion
     */
    omit?: PolicyVersionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PolicyVersionInclude<ExtArgs> | null
    /**
     * The data needed to create a PolicyVersion.
     */
    data: XOR<PolicyVersionCreateInput, PolicyVersionUncheckedCreateInput>
  }

  /**
   * PolicyVersion createMany
   */
  export type PolicyVersionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PolicyVersions.
     */
    data: PolicyVersionCreateManyInput | PolicyVersionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PolicyVersion createManyAndReturn
   */
  export type PolicyVersionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PolicyVersion
     */
    select?: PolicyVersionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PolicyVersion
     */
    omit?: PolicyVersionOmit<ExtArgs> | null
    /**
     * The data used to create many PolicyVersions.
     */
    data: PolicyVersionCreateManyInput | PolicyVersionCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PolicyVersionIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * PolicyVersion update
   */
  export type PolicyVersionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PolicyVersion
     */
    select?: PolicyVersionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PolicyVersion
     */
    omit?: PolicyVersionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PolicyVersionInclude<ExtArgs> | null
    /**
     * The data needed to update a PolicyVersion.
     */
    data: XOR<PolicyVersionUpdateInput, PolicyVersionUncheckedUpdateInput>
    /**
     * Choose, which PolicyVersion to update.
     */
    where: PolicyVersionWhereUniqueInput
  }

  /**
   * PolicyVersion updateMany
   */
  export type PolicyVersionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PolicyVersions.
     */
    data: XOR<PolicyVersionUpdateManyMutationInput, PolicyVersionUncheckedUpdateManyInput>
    /**
     * Filter which PolicyVersions to update
     */
    where?: PolicyVersionWhereInput
    /**
     * Limit how many PolicyVersions to update.
     */
    limit?: number
  }

  /**
   * PolicyVersion updateManyAndReturn
   */
  export type PolicyVersionUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PolicyVersion
     */
    select?: PolicyVersionSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PolicyVersion
     */
    omit?: PolicyVersionOmit<ExtArgs> | null
    /**
     * The data used to update PolicyVersions.
     */
    data: XOR<PolicyVersionUpdateManyMutationInput, PolicyVersionUncheckedUpdateManyInput>
    /**
     * Filter which PolicyVersions to update
     */
    where?: PolicyVersionWhereInput
    /**
     * Limit how many PolicyVersions to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PolicyVersionIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * PolicyVersion upsert
   */
  export type PolicyVersionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PolicyVersion
     */
    select?: PolicyVersionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PolicyVersion
     */
    omit?: PolicyVersionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PolicyVersionInclude<ExtArgs> | null
    /**
     * The filter to search for the PolicyVersion to update in case it exists.
     */
    where: PolicyVersionWhereUniqueInput
    /**
     * In case the PolicyVersion found by the `where` argument doesn't exist, create a new PolicyVersion with this data.
     */
    create: XOR<PolicyVersionCreateInput, PolicyVersionUncheckedCreateInput>
    /**
     * In case the PolicyVersion was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PolicyVersionUpdateInput, PolicyVersionUncheckedUpdateInput>
  }

  /**
   * PolicyVersion delete
   */
  export type PolicyVersionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PolicyVersion
     */
    select?: PolicyVersionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PolicyVersion
     */
    omit?: PolicyVersionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PolicyVersionInclude<ExtArgs> | null
    /**
     * Filter which PolicyVersion to delete.
     */
    where: PolicyVersionWhereUniqueInput
  }

  /**
   * PolicyVersion deleteMany
   */
  export type PolicyVersionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PolicyVersions to delete
     */
    where?: PolicyVersionWhereInput
    /**
     * Limit how many PolicyVersions to delete.
     */
    limit?: number
  }

  /**
   * PolicyVersion.notices
   */
  export type PolicyVersion$noticesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Notice
     */
    select?: NoticeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Notice
     */
    omit?: NoticeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: NoticeInclude<ExtArgs> | null
    where?: NoticeWhereInput
    orderBy?: NoticeOrderByWithRelationInput | NoticeOrderByWithRelationInput[]
    cursor?: NoticeWhereUniqueInput
    take?: number
    skip?: number
    distinct?: NoticeScalarFieldEnum | NoticeScalarFieldEnum[]
  }

  /**
   * PolicyVersion.consentRecords
   */
  export type PolicyVersion$consentRecordsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConsentRecord
     */
    select?: ConsentRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ConsentRecord
     */
    omit?: ConsentRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConsentRecordInclude<ExtArgs> | null
    where?: ConsentRecordWhereInput
    orderBy?: ConsentRecordOrderByWithRelationInput | ConsentRecordOrderByWithRelationInput[]
    cursor?: ConsentRecordWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ConsentRecordScalarFieldEnum | ConsentRecordScalarFieldEnum[]
  }

  /**
   * PolicyVersion without action
   */
  export type PolicyVersionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PolicyVersion
     */
    select?: PolicyVersionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PolicyVersion
     */
    omit?: PolicyVersionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PolicyVersionInclude<ExtArgs> | null
  }


  /**
   * Model Notice
   */

  export type AggregateNotice = {
    _count: NoticeCountAggregateOutputType | null
    _min: NoticeMinAggregateOutputType | null
    _max: NoticeMaxAggregateOutputType | null
  }

  export type NoticeMinAggregateOutputType = {
    id: string | null
    organisationId: string | null
    policyVersionId: string | null
    version: string | null
    locale: string | null
    publishedAt: Date | null
  }

  export type NoticeMaxAggregateOutputType = {
    id: string | null
    organisationId: string | null
    policyVersionId: string | null
    version: string | null
    locale: string | null
    publishedAt: Date | null
  }

  export type NoticeCountAggregateOutputType = {
    id: number
    organisationId: number
    policyVersionId: number
    version: number
    locale: number
    publishedAt: number
    _all: number
  }


  export type NoticeMinAggregateInputType = {
    id?: true
    organisationId?: true
    policyVersionId?: true
    version?: true
    locale?: true
    publishedAt?: true
  }

  export type NoticeMaxAggregateInputType = {
    id?: true
    organisationId?: true
    policyVersionId?: true
    version?: true
    locale?: true
    publishedAt?: true
  }

  export type NoticeCountAggregateInputType = {
    id?: true
    organisationId?: true
    policyVersionId?: true
    version?: true
    locale?: true
    publishedAt?: true
    _all?: true
  }

  export type NoticeAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Notice to aggregate.
     */
    where?: NoticeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Notices to fetch.
     */
    orderBy?: NoticeOrderByWithRelationInput | NoticeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: NoticeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Notices from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Notices.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Notices
    **/
    _count?: true | NoticeCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: NoticeMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: NoticeMaxAggregateInputType
  }

  export type GetNoticeAggregateType<T extends NoticeAggregateArgs> = {
        [P in keyof T & keyof AggregateNotice]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateNotice[P]>
      : GetScalarType<T[P], AggregateNotice[P]>
  }




  export type NoticeGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: NoticeWhereInput
    orderBy?: NoticeOrderByWithAggregationInput | NoticeOrderByWithAggregationInput[]
    by: NoticeScalarFieldEnum[] | NoticeScalarFieldEnum
    having?: NoticeScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: NoticeCountAggregateInputType | true
    _min?: NoticeMinAggregateInputType
    _max?: NoticeMaxAggregateInputType
  }

  export type NoticeGroupByOutputType = {
    id: string
    organisationId: string
    policyVersionId: string
    version: string
    locale: string
    publishedAt: Date
    _count: NoticeCountAggregateOutputType | null
    _min: NoticeMinAggregateOutputType | null
    _max: NoticeMaxAggregateOutputType | null
  }

  type GetNoticeGroupByPayload<T extends NoticeGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<NoticeGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof NoticeGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], NoticeGroupByOutputType[P]>
            : GetScalarType<T[P], NoticeGroupByOutputType[P]>
        }
      >
    >


  export type NoticeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organisationId?: boolean
    policyVersionId?: boolean
    version?: boolean
    locale?: boolean
    publishedAt?: boolean
    organisation?: boolean | OrganisationDefaultArgs<ExtArgs>
    policyVersion?: boolean | PolicyVersionDefaultArgs<ExtArgs>
    purposes?: boolean | Notice$purposesArgs<ExtArgs>
    consentRecords?: boolean | Notice$consentRecordsArgs<ExtArgs>
    _count?: boolean | NoticeCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["notice"]>

  export type NoticeSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organisationId?: boolean
    policyVersionId?: boolean
    version?: boolean
    locale?: boolean
    publishedAt?: boolean
    organisation?: boolean | OrganisationDefaultArgs<ExtArgs>
    policyVersion?: boolean | PolicyVersionDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["notice"]>

  export type NoticeSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organisationId?: boolean
    policyVersionId?: boolean
    version?: boolean
    locale?: boolean
    publishedAt?: boolean
    organisation?: boolean | OrganisationDefaultArgs<ExtArgs>
    policyVersion?: boolean | PolicyVersionDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["notice"]>

  export type NoticeSelectScalar = {
    id?: boolean
    organisationId?: boolean
    policyVersionId?: boolean
    version?: boolean
    locale?: boolean
    publishedAt?: boolean
  }

  export type NoticeOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "organisationId" | "policyVersionId" | "version" | "locale" | "publishedAt", ExtArgs["result"]["notice"]>
  export type NoticeInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    organisation?: boolean | OrganisationDefaultArgs<ExtArgs>
    policyVersion?: boolean | PolicyVersionDefaultArgs<ExtArgs>
    purposes?: boolean | Notice$purposesArgs<ExtArgs>
    consentRecords?: boolean | Notice$consentRecordsArgs<ExtArgs>
    _count?: boolean | NoticeCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type NoticeIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    organisation?: boolean | OrganisationDefaultArgs<ExtArgs>
    policyVersion?: boolean | PolicyVersionDefaultArgs<ExtArgs>
  }
  export type NoticeIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    organisation?: boolean | OrganisationDefaultArgs<ExtArgs>
    policyVersion?: boolean | PolicyVersionDefaultArgs<ExtArgs>
  }

  export type $NoticePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Notice"
    objects: {
      organisation: Prisma.$OrganisationPayload<ExtArgs>
      policyVersion: Prisma.$PolicyVersionPayload<ExtArgs>
      purposes: Prisma.$NoticePurposePayload<ExtArgs>[]
      consentRecords: Prisma.$ConsentRecordPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      organisationId: string
      policyVersionId: string
      version: string
      locale: string
      publishedAt: Date
    }, ExtArgs["result"]["notice"]>
    composites: {}
  }

  type NoticeGetPayload<S extends boolean | null | undefined | NoticeDefaultArgs> = $Result.GetResult<Prisma.$NoticePayload, S>

  type NoticeCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<NoticeFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: NoticeCountAggregateInputType | true
    }

  export interface NoticeDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Notice'], meta: { name: 'Notice' } }
    /**
     * Find zero or one Notice that matches the filter.
     * @param {NoticeFindUniqueArgs} args - Arguments to find a Notice
     * @example
     * // Get one Notice
     * const notice = await prisma.notice.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends NoticeFindUniqueArgs>(args: SelectSubset<T, NoticeFindUniqueArgs<ExtArgs>>): Prisma__NoticeClient<$Result.GetResult<Prisma.$NoticePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Notice that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {NoticeFindUniqueOrThrowArgs} args - Arguments to find a Notice
     * @example
     * // Get one Notice
     * const notice = await prisma.notice.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends NoticeFindUniqueOrThrowArgs>(args: SelectSubset<T, NoticeFindUniqueOrThrowArgs<ExtArgs>>): Prisma__NoticeClient<$Result.GetResult<Prisma.$NoticePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Notice that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {NoticeFindFirstArgs} args - Arguments to find a Notice
     * @example
     * // Get one Notice
     * const notice = await prisma.notice.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends NoticeFindFirstArgs>(args?: SelectSubset<T, NoticeFindFirstArgs<ExtArgs>>): Prisma__NoticeClient<$Result.GetResult<Prisma.$NoticePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Notice that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {NoticeFindFirstOrThrowArgs} args - Arguments to find a Notice
     * @example
     * // Get one Notice
     * const notice = await prisma.notice.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends NoticeFindFirstOrThrowArgs>(args?: SelectSubset<T, NoticeFindFirstOrThrowArgs<ExtArgs>>): Prisma__NoticeClient<$Result.GetResult<Prisma.$NoticePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Notices that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {NoticeFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Notices
     * const notices = await prisma.notice.findMany()
     * 
     * // Get first 10 Notices
     * const notices = await prisma.notice.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const noticeWithIdOnly = await prisma.notice.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends NoticeFindManyArgs>(args?: SelectSubset<T, NoticeFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$NoticePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Notice.
     * @param {NoticeCreateArgs} args - Arguments to create a Notice.
     * @example
     * // Create one Notice
     * const Notice = await prisma.notice.create({
     *   data: {
     *     // ... data to create a Notice
     *   }
     * })
     * 
     */
    create<T extends NoticeCreateArgs>(args: SelectSubset<T, NoticeCreateArgs<ExtArgs>>): Prisma__NoticeClient<$Result.GetResult<Prisma.$NoticePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Notices.
     * @param {NoticeCreateManyArgs} args - Arguments to create many Notices.
     * @example
     * // Create many Notices
     * const notice = await prisma.notice.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends NoticeCreateManyArgs>(args?: SelectSubset<T, NoticeCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Notices and returns the data saved in the database.
     * @param {NoticeCreateManyAndReturnArgs} args - Arguments to create many Notices.
     * @example
     * // Create many Notices
     * const notice = await prisma.notice.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Notices and only return the `id`
     * const noticeWithIdOnly = await prisma.notice.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends NoticeCreateManyAndReturnArgs>(args?: SelectSubset<T, NoticeCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$NoticePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Notice.
     * @param {NoticeDeleteArgs} args - Arguments to delete one Notice.
     * @example
     * // Delete one Notice
     * const Notice = await prisma.notice.delete({
     *   where: {
     *     // ... filter to delete one Notice
     *   }
     * })
     * 
     */
    delete<T extends NoticeDeleteArgs>(args: SelectSubset<T, NoticeDeleteArgs<ExtArgs>>): Prisma__NoticeClient<$Result.GetResult<Prisma.$NoticePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Notice.
     * @param {NoticeUpdateArgs} args - Arguments to update one Notice.
     * @example
     * // Update one Notice
     * const notice = await prisma.notice.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends NoticeUpdateArgs>(args: SelectSubset<T, NoticeUpdateArgs<ExtArgs>>): Prisma__NoticeClient<$Result.GetResult<Prisma.$NoticePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Notices.
     * @param {NoticeDeleteManyArgs} args - Arguments to filter Notices to delete.
     * @example
     * // Delete a few Notices
     * const { count } = await prisma.notice.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends NoticeDeleteManyArgs>(args?: SelectSubset<T, NoticeDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Notices.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {NoticeUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Notices
     * const notice = await prisma.notice.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends NoticeUpdateManyArgs>(args: SelectSubset<T, NoticeUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Notices and returns the data updated in the database.
     * @param {NoticeUpdateManyAndReturnArgs} args - Arguments to update many Notices.
     * @example
     * // Update many Notices
     * const notice = await prisma.notice.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Notices and only return the `id`
     * const noticeWithIdOnly = await prisma.notice.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends NoticeUpdateManyAndReturnArgs>(args: SelectSubset<T, NoticeUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$NoticePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Notice.
     * @param {NoticeUpsertArgs} args - Arguments to update or create a Notice.
     * @example
     * // Update or create a Notice
     * const notice = await prisma.notice.upsert({
     *   create: {
     *     // ... data to create a Notice
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Notice we want to update
     *   }
     * })
     */
    upsert<T extends NoticeUpsertArgs>(args: SelectSubset<T, NoticeUpsertArgs<ExtArgs>>): Prisma__NoticeClient<$Result.GetResult<Prisma.$NoticePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Notices.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {NoticeCountArgs} args - Arguments to filter Notices to count.
     * @example
     * // Count the number of Notices
     * const count = await prisma.notice.count({
     *   where: {
     *     // ... the filter for the Notices we want to count
     *   }
     * })
    **/
    count<T extends NoticeCountArgs>(
      args?: Subset<T, NoticeCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], NoticeCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Notice.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {NoticeAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends NoticeAggregateArgs>(args: Subset<T, NoticeAggregateArgs>): Prisma.PrismaPromise<GetNoticeAggregateType<T>>

    /**
     * Group by Notice.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {NoticeGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends NoticeGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: NoticeGroupByArgs['orderBy'] }
        : { orderBy?: NoticeGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, NoticeGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetNoticeGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Notice model
   */
  readonly fields: NoticeFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Notice.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__NoticeClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    organisation<T extends OrganisationDefaultArgs<ExtArgs> = {}>(args?: Subset<T, OrganisationDefaultArgs<ExtArgs>>): Prisma__OrganisationClient<$Result.GetResult<Prisma.$OrganisationPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    policyVersion<T extends PolicyVersionDefaultArgs<ExtArgs> = {}>(args?: Subset<T, PolicyVersionDefaultArgs<ExtArgs>>): Prisma__PolicyVersionClient<$Result.GetResult<Prisma.$PolicyVersionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    purposes<T extends Notice$purposesArgs<ExtArgs> = {}>(args?: Subset<T, Notice$purposesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$NoticePurposePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    consentRecords<T extends Notice$consentRecordsArgs<ExtArgs> = {}>(args?: Subset<T, Notice$consentRecordsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ConsentRecordPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Notice model
   */
  interface NoticeFieldRefs {
    readonly id: FieldRef<"Notice", 'String'>
    readonly organisationId: FieldRef<"Notice", 'String'>
    readonly policyVersionId: FieldRef<"Notice", 'String'>
    readonly version: FieldRef<"Notice", 'String'>
    readonly locale: FieldRef<"Notice", 'String'>
    readonly publishedAt: FieldRef<"Notice", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Notice findUnique
   */
  export type NoticeFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Notice
     */
    select?: NoticeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Notice
     */
    omit?: NoticeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: NoticeInclude<ExtArgs> | null
    /**
     * Filter, which Notice to fetch.
     */
    where: NoticeWhereUniqueInput
  }

  /**
   * Notice findUniqueOrThrow
   */
  export type NoticeFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Notice
     */
    select?: NoticeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Notice
     */
    omit?: NoticeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: NoticeInclude<ExtArgs> | null
    /**
     * Filter, which Notice to fetch.
     */
    where: NoticeWhereUniqueInput
  }

  /**
   * Notice findFirst
   */
  export type NoticeFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Notice
     */
    select?: NoticeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Notice
     */
    omit?: NoticeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: NoticeInclude<ExtArgs> | null
    /**
     * Filter, which Notice to fetch.
     */
    where?: NoticeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Notices to fetch.
     */
    orderBy?: NoticeOrderByWithRelationInput | NoticeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Notices.
     */
    cursor?: NoticeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Notices from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Notices.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Notices.
     */
    distinct?: NoticeScalarFieldEnum | NoticeScalarFieldEnum[]
  }

  /**
   * Notice findFirstOrThrow
   */
  export type NoticeFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Notice
     */
    select?: NoticeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Notice
     */
    omit?: NoticeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: NoticeInclude<ExtArgs> | null
    /**
     * Filter, which Notice to fetch.
     */
    where?: NoticeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Notices to fetch.
     */
    orderBy?: NoticeOrderByWithRelationInput | NoticeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Notices.
     */
    cursor?: NoticeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Notices from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Notices.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Notices.
     */
    distinct?: NoticeScalarFieldEnum | NoticeScalarFieldEnum[]
  }

  /**
   * Notice findMany
   */
  export type NoticeFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Notice
     */
    select?: NoticeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Notice
     */
    omit?: NoticeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: NoticeInclude<ExtArgs> | null
    /**
     * Filter, which Notices to fetch.
     */
    where?: NoticeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Notices to fetch.
     */
    orderBy?: NoticeOrderByWithRelationInput | NoticeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Notices.
     */
    cursor?: NoticeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Notices from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Notices.
     */
    skip?: number
    distinct?: NoticeScalarFieldEnum | NoticeScalarFieldEnum[]
  }

  /**
   * Notice create
   */
  export type NoticeCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Notice
     */
    select?: NoticeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Notice
     */
    omit?: NoticeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: NoticeInclude<ExtArgs> | null
    /**
     * The data needed to create a Notice.
     */
    data: XOR<NoticeCreateInput, NoticeUncheckedCreateInput>
  }

  /**
   * Notice createMany
   */
  export type NoticeCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Notices.
     */
    data: NoticeCreateManyInput | NoticeCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Notice createManyAndReturn
   */
  export type NoticeCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Notice
     */
    select?: NoticeSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Notice
     */
    omit?: NoticeOmit<ExtArgs> | null
    /**
     * The data used to create many Notices.
     */
    data: NoticeCreateManyInput | NoticeCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: NoticeIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Notice update
   */
  export type NoticeUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Notice
     */
    select?: NoticeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Notice
     */
    omit?: NoticeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: NoticeInclude<ExtArgs> | null
    /**
     * The data needed to update a Notice.
     */
    data: XOR<NoticeUpdateInput, NoticeUncheckedUpdateInput>
    /**
     * Choose, which Notice to update.
     */
    where: NoticeWhereUniqueInput
  }

  /**
   * Notice updateMany
   */
  export type NoticeUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Notices.
     */
    data: XOR<NoticeUpdateManyMutationInput, NoticeUncheckedUpdateManyInput>
    /**
     * Filter which Notices to update
     */
    where?: NoticeWhereInput
    /**
     * Limit how many Notices to update.
     */
    limit?: number
  }

  /**
   * Notice updateManyAndReturn
   */
  export type NoticeUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Notice
     */
    select?: NoticeSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Notice
     */
    omit?: NoticeOmit<ExtArgs> | null
    /**
     * The data used to update Notices.
     */
    data: XOR<NoticeUpdateManyMutationInput, NoticeUncheckedUpdateManyInput>
    /**
     * Filter which Notices to update
     */
    where?: NoticeWhereInput
    /**
     * Limit how many Notices to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: NoticeIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Notice upsert
   */
  export type NoticeUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Notice
     */
    select?: NoticeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Notice
     */
    omit?: NoticeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: NoticeInclude<ExtArgs> | null
    /**
     * The filter to search for the Notice to update in case it exists.
     */
    where: NoticeWhereUniqueInput
    /**
     * In case the Notice found by the `where` argument doesn't exist, create a new Notice with this data.
     */
    create: XOR<NoticeCreateInput, NoticeUncheckedCreateInput>
    /**
     * In case the Notice was found with the provided `where` argument, update it with this data.
     */
    update: XOR<NoticeUpdateInput, NoticeUncheckedUpdateInput>
  }

  /**
   * Notice delete
   */
  export type NoticeDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Notice
     */
    select?: NoticeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Notice
     */
    omit?: NoticeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: NoticeInclude<ExtArgs> | null
    /**
     * Filter which Notice to delete.
     */
    where: NoticeWhereUniqueInput
  }

  /**
   * Notice deleteMany
   */
  export type NoticeDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Notices to delete
     */
    where?: NoticeWhereInput
    /**
     * Limit how many Notices to delete.
     */
    limit?: number
  }

  /**
   * Notice.purposes
   */
  export type Notice$purposesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the NoticePurpose
     */
    select?: NoticePurposeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the NoticePurpose
     */
    omit?: NoticePurposeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: NoticePurposeInclude<ExtArgs> | null
    where?: NoticePurposeWhereInput
    orderBy?: NoticePurposeOrderByWithRelationInput | NoticePurposeOrderByWithRelationInput[]
    cursor?: NoticePurposeWhereUniqueInput
    take?: number
    skip?: number
    distinct?: NoticePurposeScalarFieldEnum | NoticePurposeScalarFieldEnum[]
  }

  /**
   * Notice.consentRecords
   */
  export type Notice$consentRecordsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConsentRecord
     */
    select?: ConsentRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ConsentRecord
     */
    omit?: ConsentRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConsentRecordInclude<ExtArgs> | null
    where?: ConsentRecordWhereInput
    orderBy?: ConsentRecordOrderByWithRelationInput | ConsentRecordOrderByWithRelationInput[]
    cursor?: ConsentRecordWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ConsentRecordScalarFieldEnum | ConsentRecordScalarFieldEnum[]
  }

  /**
   * Notice without action
   */
  export type NoticeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Notice
     */
    select?: NoticeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Notice
     */
    omit?: NoticeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: NoticeInclude<ExtArgs> | null
  }


  /**
   * Model NoticePurpose
   */

  export type AggregateNoticePurpose = {
    _count: NoticePurposeCountAggregateOutputType | null
    _min: NoticePurposeMinAggregateOutputType | null
    _max: NoticePurposeMaxAggregateOutputType | null
  }

  export type NoticePurposeMinAggregateOutputType = {
    noticeId: string | null
    purposeId: string | null
  }

  export type NoticePurposeMaxAggregateOutputType = {
    noticeId: string | null
    purposeId: string | null
  }

  export type NoticePurposeCountAggregateOutputType = {
    noticeId: number
    purposeId: number
    _all: number
  }


  export type NoticePurposeMinAggregateInputType = {
    noticeId?: true
    purposeId?: true
  }

  export type NoticePurposeMaxAggregateInputType = {
    noticeId?: true
    purposeId?: true
  }

  export type NoticePurposeCountAggregateInputType = {
    noticeId?: true
    purposeId?: true
    _all?: true
  }

  export type NoticePurposeAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which NoticePurpose to aggregate.
     */
    where?: NoticePurposeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of NoticePurposes to fetch.
     */
    orderBy?: NoticePurposeOrderByWithRelationInput | NoticePurposeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: NoticePurposeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` NoticePurposes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` NoticePurposes.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned NoticePurposes
    **/
    _count?: true | NoticePurposeCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: NoticePurposeMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: NoticePurposeMaxAggregateInputType
  }

  export type GetNoticePurposeAggregateType<T extends NoticePurposeAggregateArgs> = {
        [P in keyof T & keyof AggregateNoticePurpose]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateNoticePurpose[P]>
      : GetScalarType<T[P], AggregateNoticePurpose[P]>
  }




  export type NoticePurposeGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: NoticePurposeWhereInput
    orderBy?: NoticePurposeOrderByWithAggregationInput | NoticePurposeOrderByWithAggregationInput[]
    by: NoticePurposeScalarFieldEnum[] | NoticePurposeScalarFieldEnum
    having?: NoticePurposeScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: NoticePurposeCountAggregateInputType | true
    _min?: NoticePurposeMinAggregateInputType
    _max?: NoticePurposeMaxAggregateInputType
  }

  export type NoticePurposeGroupByOutputType = {
    noticeId: string
    purposeId: string
    _count: NoticePurposeCountAggregateOutputType | null
    _min: NoticePurposeMinAggregateOutputType | null
    _max: NoticePurposeMaxAggregateOutputType | null
  }

  type GetNoticePurposeGroupByPayload<T extends NoticePurposeGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<NoticePurposeGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof NoticePurposeGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], NoticePurposeGroupByOutputType[P]>
            : GetScalarType<T[P], NoticePurposeGroupByOutputType[P]>
        }
      >
    >


  export type NoticePurposeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    noticeId?: boolean
    purposeId?: boolean
    notice?: boolean | NoticeDefaultArgs<ExtArgs>
    purpose?: boolean | PurposeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["noticePurpose"]>

  export type NoticePurposeSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    noticeId?: boolean
    purposeId?: boolean
    notice?: boolean | NoticeDefaultArgs<ExtArgs>
    purpose?: boolean | PurposeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["noticePurpose"]>

  export type NoticePurposeSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    noticeId?: boolean
    purposeId?: boolean
    notice?: boolean | NoticeDefaultArgs<ExtArgs>
    purpose?: boolean | PurposeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["noticePurpose"]>

  export type NoticePurposeSelectScalar = {
    noticeId?: boolean
    purposeId?: boolean
  }

  export type NoticePurposeOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"noticeId" | "purposeId", ExtArgs["result"]["noticePurpose"]>
  export type NoticePurposeInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    notice?: boolean | NoticeDefaultArgs<ExtArgs>
    purpose?: boolean | PurposeDefaultArgs<ExtArgs>
  }
  export type NoticePurposeIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    notice?: boolean | NoticeDefaultArgs<ExtArgs>
    purpose?: boolean | PurposeDefaultArgs<ExtArgs>
  }
  export type NoticePurposeIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    notice?: boolean | NoticeDefaultArgs<ExtArgs>
    purpose?: boolean | PurposeDefaultArgs<ExtArgs>
  }

  export type $NoticePurposePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "NoticePurpose"
    objects: {
      notice: Prisma.$NoticePayload<ExtArgs>
      purpose: Prisma.$PurposePayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      noticeId: string
      purposeId: string
    }, ExtArgs["result"]["noticePurpose"]>
    composites: {}
  }

  type NoticePurposeGetPayload<S extends boolean | null | undefined | NoticePurposeDefaultArgs> = $Result.GetResult<Prisma.$NoticePurposePayload, S>

  type NoticePurposeCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<NoticePurposeFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: NoticePurposeCountAggregateInputType | true
    }

  export interface NoticePurposeDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['NoticePurpose'], meta: { name: 'NoticePurpose' } }
    /**
     * Find zero or one NoticePurpose that matches the filter.
     * @param {NoticePurposeFindUniqueArgs} args - Arguments to find a NoticePurpose
     * @example
     * // Get one NoticePurpose
     * const noticePurpose = await prisma.noticePurpose.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends NoticePurposeFindUniqueArgs>(args: SelectSubset<T, NoticePurposeFindUniqueArgs<ExtArgs>>): Prisma__NoticePurposeClient<$Result.GetResult<Prisma.$NoticePurposePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one NoticePurpose that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {NoticePurposeFindUniqueOrThrowArgs} args - Arguments to find a NoticePurpose
     * @example
     * // Get one NoticePurpose
     * const noticePurpose = await prisma.noticePurpose.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends NoticePurposeFindUniqueOrThrowArgs>(args: SelectSubset<T, NoticePurposeFindUniqueOrThrowArgs<ExtArgs>>): Prisma__NoticePurposeClient<$Result.GetResult<Prisma.$NoticePurposePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first NoticePurpose that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {NoticePurposeFindFirstArgs} args - Arguments to find a NoticePurpose
     * @example
     * // Get one NoticePurpose
     * const noticePurpose = await prisma.noticePurpose.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends NoticePurposeFindFirstArgs>(args?: SelectSubset<T, NoticePurposeFindFirstArgs<ExtArgs>>): Prisma__NoticePurposeClient<$Result.GetResult<Prisma.$NoticePurposePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first NoticePurpose that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {NoticePurposeFindFirstOrThrowArgs} args - Arguments to find a NoticePurpose
     * @example
     * // Get one NoticePurpose
     * const noticePurpose = await prisma.noticePurpose.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends NoticePurposeFindFirstOrThrowArgs>(args?: SelectSubset<T, NoticePurposeFindFirstOrThrowArgs<ExtArgs>>): Prisma__NoticePurposeClient<$Result.GetResult<Prisma.$NoticePurposePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more NoticePurposes that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {NoticePurposeFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all NoticePurposes
     * const noticePurposes = await prisma.noticePurpose.findMany()
     * 
     * // Get first 10 NoticePurposes
     * const noticePurposes = await prisma.noticePurpose.findMany({ take: 10 })
     * 
     * // Only select the `noticeId`
     * const noticePurposeWithNoticeIdOnly = await prisma.noticePurpose.findMany({ select: { noticeId: true } })
     * 
     */
    findMany<T extends NoticePurposeFindManyArgs>(args?: SelectSubset<T, NoticePurposeFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$NoticePurposePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a NoticePurpose.
     * @param {NoticePurposeCreateArgs} args - Arguments to create a NoticePurpose.
     * @example
     * // Create one NoticePurpose
     * const NoticePurpose = await prisma.noticePurpose.create({
     *   data: {
     *     // ... data to create a NoticePurpose
     *   }
     * })
     * 
     */
    create<T extends NoticePurposeCreateArgs>(args: SelectSubset<T, NoticePurposeCreateArgs<ExtArgs>>): Prisma__NoticePurposeClient<$Result.GetResult<Prisma.$NoticePurposePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many NoticePurposes.
     * @param {NoticePurposeCreateManyArgs} args - Arguments to create many NoticePurposes.
     * @example
     * // Create many NoticePurposes
     * const noticePurpose = await prisma.noticePurpose.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends NoticePurposeCreateManyArgs>(args?: SelectSubset<T, NoticePurposeCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many NoticePurposes and returns the data saved in the database.
     * @param {NoticePurposeCreateManyAndReturnArgs} args - Arguments to create many NoticePurposes.
     * @example
     * // Create many NoticePurposes
     * const noticePurpose = await prisma.noticePurpose.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many NoticePurposes and only return the `noticeId`
     * const noticePurposeWithNoticeIdOnly = await prisma.noticePurpose.createManyAndReturn({
     *   select: { noticeId: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends NoticePurposeCreateManyAndReturnArgs>(args?: SelectSubset<T, NoticePurposeCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$NoticePurposePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a NoticePurpose.
     * @param {NoticePurposeDeleteArgs} args - Arguments to delete one NoticePurpose.
     * @example
     * // Delete one NoticePurpose
     * const NoticePurpose = await prisma.noticePurpose.delete({
     *   where: {
     *     // ... filter to delete one NoticePurpose
     *   }
     * })
     * 
     */
    delete<T extends NoticePurposeDeleteArgs>(args: SelectSubset<T, NoticePurposeDeleteArgs<ExtArgs>>): Prisma__NoticePurposeClient<$Result.GetResult<Prisma.$NoticePurposePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one NoticePurpose.
     * @param {NoticePurposeUpdateArgs} args - Arguments to update one NoticePurpose.
     * @example
     * // Update one NoticePurpose
     * const noticePurpose = await prisma.noticePurpose.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends NoticePurposeUpdateArgs>(args: SelectSubset<T, NoticePurposeUpdateArgs<ExtArgs>>): Prisma__NoticePurposeClient<$Result.GetResult<Prisma.$NoticePurposePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more NoticePurposes.
     * @param {NoticePurposeDeleteManyArgs} args - Arguments to filter NoticePurposes to delete.
     * @example
     * // Delete a few NoticePurposes
     * const { count } = await prisma.noticePurpose.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends NoticePurposeDeleteManyArgs>(args?: SelectSubset<T, NoticePurposeDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more NoticePurposes.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {NoticePurposeUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many NoticePurposes
     * const noticePurpose = await prisma.noticePurpose.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends NoticePurposeUpdateManyArgs>(args: SelectSubset<T, NoticePurposeUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more NoticePurposes and returns the data updated in the database.
     * @param {NoticePurposeUpdateManyAndReturnArgs} args - Arguments to update many NoticePurposes.
     * @example
     * // Update many NoticePurposes
     * const noticePurpose = await prisma.noticePurpose.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more NoticePurposes and only return the `noticeId`
     * const noticePurposeWithNoticeIdOnly = await prisma.noticePurpose.updateManyAndReturn({
     *   select: { noticeId: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends NoticePurposeUpdateManyAndReturnArgs>(args: SelectSubset<T, NoticePurposeUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$NoticePurposePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one NoticePurpose.
     * @param {NoticePurposeUpsertArgs} args - Arguments to update or create a NoticePurpose.
     * @example
     * // Update or create a NoticePurpose
     * const noticePurpose = await prisma.noticePurpose.upsert({
     *   create: {
     *     // ... data to create a NoticePurpose
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the NoticePurpose we want to update
     *   }
     * })
     */
    upsert<T extends NoticePurposeUpsertArgs>(args: SelectSubset<T, NoticePurposeUpsertArgs<ExtArgs>>): Prisma__NoticePurposeClient<$Result.GetResult<Prisma.$NoticePurposePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of NoticePurposes.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {NoticePurposeCountArgs} args - Arguments to filter NoticePurposes to count.
     * @example
     * // Count the number of NoticePurposes
     * const count = await prisma.noticePurpose.count({
     *   where: {
     *     // ... the filter for the NoticePurposes we want to count
     *   }
     * })
    **/
    count<T extends NoticePurposeCountArgs>(
      args?: Subset<T, NoticePurposeCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], NoticePurposeCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a NoticePurpose.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {NoticePurposeAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends NoticePurposeAggregateArgs>(args: Subset<T, NoticePurposeAggregateArgs>): Prisma.PrismaPromise<GetNoticePurposeAggregateType<T>>

    /**
     * Group by NoticePurpose.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {NoticePurposeGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends NoticePurposeGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: NoticePurposeGroupByArgs['orderBy'] }
        : { orderBy?: NoticePurposeGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, NoticePurposeGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetNoticePurposeGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the NoticePurpose model
   */
  readonly fields: NoticePurposeFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for NoticePurpose.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__NoticePurposeClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    notice<T extends NoticeDefaultArgs<ExtArgs> = {}>(args?: Subset<T, NoticeDefaultArgs<ExtArgs>>): Prisma__NoticeClient<$Result.GetResult<Prisma.$NoticePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    purpose<T extends PurposeDefaultArgs<ExtArgs> = {}>(args?: Subset<T, PurposeDefaultArgs<ExtArgs>>): Prisma__PurposeClient<$Result.GetResult<Prisma.$PurposePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the NoticePurpose model
   */
  interface NoticePurposeFieldRefs {
    readonly noticeId: FieldRef<"NoticePurpose", 'String'>
    readonly purposeId: FieldRef<"NoticePurpose", 'String'>
  }
    

  // Custom InputTypes
  /**
   * NoticePurpose findUnique
   */
  export type NoticePurposeFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the NoticePurpose
     */
    select?: NoticePurposeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the NoticePurpose
     */
    omit?: NoticePurposeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: NoticePurposeInclude<ExtArgs> | null
    /**
     * Filter, which NoticePurpose to fetch.
     */
    where: NoticePurposeWhereUniqueInput
  }

  /**
   * NoticePurpose findUniqueOrThrow
   */
  export type NoticePurposeFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the NoticePurpose
     */
    select?: NoticePurposeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the NoticePurpose
     */
    omit?: NoticePurposeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: NoticePurposeInclude<ExtArgs> | null
    /**
     * Filter, which NoticePurpose to fetch.
     */
    where: NoticePurposeWhereUniqueInput
  }

  /**
   * NoticePurpose findFirst
   */
  export type NoticePurposeFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the NoticePurpose
     */
    select?: NoticePurposeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the NoticePurpose
     */
    omit?: NoticePurposeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: NoticePurposeInclude<ExtArgs> | null
    /**
     * Filter, which NoticePurpose to fetch.
     */
    where?: NoticePurposeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of NoticePurposes to fetch.
     */
    orderBy?: NoticePurposeOrderByWithRelationInput | NoticePurposeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for NoticePurposes.
     */
    cursor?: NoticePurposeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` NoticePurposes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` NoticePurposes.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of NoticePurposes.
     */
    distinct?: NoticePurposeScalarFieldEnum | NoticePurposeScalarFieldEnum[]
  }

  /**
   * NoticePurpose findFirstOrThrow
   */
  export type NoticePurposeFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the NoticePurpose
     */
    select?: NoticePurposeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the NoticePurpose
     */
    omit?: NoticePurposeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: NoticePurposeInclude<ExtArgs> | null
    /**
     * Filter, which NoticePurpose to fetch.
     */
    where?: NoticePurposeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of NoticePurposes to fetch.
     */
    orderBy?: NoticePurposeOrderByWithRelationInput | NoticePurposeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for NoticePurposes.
     */
    cursor?: NoticePurposeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` NoticePurposes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` NoticePurposes.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of NoticePurposes.
     */
    distinct?: NoticePurposeScalarFieldEnum | NoticePurposeScalarFieldEnum[]
  }

  /**
   * NoticePurpose findMany
   */
  export type NoticePurposeFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the NoticePurpose
     */
    select?: NoticePurposeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the NoticePurpose
     */
    omit?: NoticePurposeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: NoticePurposeInclude<ExtArgs> | null
    /**
     * Filter, which NoticePurposes to fetch.
     */
    where?: NoticePurposeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of NoticePurposes to fetch.
     */
    orderBy?: NoticePurposeOrderByWithRelationInput | NoticePurposeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing NoticePurposes.
     */
    cursor?: NoticePurposeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` NoticePurposes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` NoticePurposes.
     */
    skip?: number
    distinct?: NoticePurposeScalarFieldEnum | NoticePurposeScalarFieldEnum[]
  }

  /**
   * NoticePurpose create
   */
  export type NoticePurposeCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the NoticePurpose
     */
    select?: NoticePurposeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the NoticePurpose
     */
    omit?: NoticePurposeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: NoticePurposeInclude<ExtArgs> | null
    /**
     * The data needed to create a NoticePurpose.
     */
    data: XOR<NoticePurposeCreateInput, NoticePurposeUncheckedCreateInput>
  }

  /**
   * NoticePurpose createMany
   */
  export type NoticePurposeCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many NoticePurposes.
     */
    data: NoticePurposeCreateManyInput | NoticePurposeCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * NoticePurpose createManyAndReturn
   */
  export type NoticePurposeCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the NoticePurpose
     */
    select?: NoticePurposeSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the NoticePurpose
     */
    omit?: NoticePurposeOmit<ExtArgs> | null
    /**
     * The data used to create many NoticePurposes.
     */
    data: NoticePurposeCreateManyInput | NoticePurposeCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: NoticePurposeIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * NoticePurpose update
   */
  export type NoticePurposeUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the NoticePurpose
     */
    select?: NoticePurposeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the NoticePurpose
     */
    omit?: NoticePurposeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: NoticePurposeInclude<ExtArgs> | null
    /**
     * The data needed to update a NoticePurpose.
     */
    data: XOR<NoticePurposeUpdateInput, NoticePurposeUncheckedUpdateInput>
    /**
     * Choose, which NoticePurpose to update.
     */
    where: NoticePurposeWhereUniqueInput
  }

  /**
   * NoticePurpose updateMany
   */
  export type NoticePurposeUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update NoticePurposes.
     */
    data: XOR<NoticePurposeUpdateManyMutationInput, NoticePurposeUncheckedUpdateManyInput>
    /**
     * Filter which NoticePurposes to update
     */
    where?: NoticePurposeWhereInput
    /**
     * Limit how many NoticePurposes to update.
     */
    limit?: number
  }

  /**
   * NoticePurpose updateManyAndReturn
   */
  export type NoticePurposeUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the NoticePurpose
     */
    select?: NoticePurposeSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the NoticePurpose
     */
    omit?: NoticePurposeOmit<ExtArgs> | null
    /**
     * The data used to update NoticePurposes.
     */
    data: XOR<NoticePurposeUpdateManyMutationInput, NoticePurposeUncheckedUpdateManyInput>
    /**
     * Filter which NoticePurposes to update
     */
    where?: NoticePurposeWhereInput
    /**
     * Limit how many NoticePurposes to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: NoticePurposeIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * NoticePurpose upsert
   */
  export type NoticePurposeUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the NoticePurpose
     */
    select?: NoticePurposeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the NoticePurpose
     */
    omit?: NoticePurposeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: NoticePurposeInclude<ExtArgs> | null
    /**
     * The filter to search for the NoticePurpose to update in case it exists.
     */
    where: NoticePurposeWhereUniqueInput
    /**
     * In case the NoticePurpose found by the `where` argument doesn't exist, create a new NoticePurpose with this data.
     */
    create: XOR<NoticePurposeCreateInput, NoticePurposeUncheckedCreateInput>
    /**
     * In case the NoticePurpose was found with the provided `where` argument, update it with this data.
     */
    update: XOR<NoticePurposeUpdateInput, NoticePurposeUncheckedUpdateInput>
  }

  /**
   * NoticePurpose delete
   */
  export type NoticePurposeDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the NoticePurpose
     */
    select?: NoticePurposeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the NoticePurpose
     */
    omit?: NoticePurposeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: NoticePurposeInclude<ExtArgs> | null
    /**
     * Filter which NoticePurpose to delete.
     */
    where: NoticePurposeWhereUniqueInput
  }

  /**
   * NoticePurpose deleteMany
   */
  export type NoticePurposeDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which NoticePurposes to delete
     */
    where?: NoticePurposeWhereInput
    /**
     * Limit how many NoticePurposes to delete.
     */
    limit?: number
  }

  /**
   * NoticePurpose without action
   */
  export type NoticePurposeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the NoticePurpose
     */
    select?: NoticePurposeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the NoticePurpose
     */
    omit?: NoticePurposeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: NoticePurposeInclude<ExtArgs> | null
  }


  /**
   * Model ConsentRecord
   */

  export type AggregateConsentRecord = {
    _count: ConsentRecordCountAggregateOutputType | null
    _min: ConsentRecordMinAggregateOutputType | null
    _max: ConsentRecordMaxAggregateOutputType | null
  }

  export type ConsentRecordMinAggregateOutputType = {
    id: string | null
    organisationId: string | null
    siteId: string | null
    principalId: string | null
    purposeId: string | null
    noticeId: string | null
    policyVersionId: string | null
    status: string | null
    source: string | null
    decidedAt: Date | null
    recordedAt: Date | null
  }

  export type ConsentRecordMaxAggregateOutputType = {
    id: string | null
    organisationId: string | null
    siteId: string | null
    principalId: string | null
    purposeId: string | null
    noticeId: string | null
    policyVersionId: string | null
    status: string | null
    source: string | null
    decidedAt: Date | null
    recordedAt: Date | null
  }

  export type ConsentRecordCountAggregateOutputType = {
    id: number
    organisationId: number
    siteId: number
    principalId: number
    purposeId: number
    noticeId: number
    policyVersionId: number
    status: number
    source: number
    decidedAt: number
    recordedAt: number
    metadata: number
    _all: number
  }


  export type ConsentRecordMinAggregateInputType = {
    id?: true
    organisationId?: true
    siteId?: true
    principalId?: true
    purposeId?: true
    noticeId?: true
    policyVersionId?: true
    status?: true
    source?: true
    decidedAt?: true
    recordedAt?: true
  }

  export type ConsentRecordMaxAggregateInputType = {
    id?: true
    organisationId?: true
    siteId?: true
    principalId?: true
    purposeId?: true
    noticeId?: true
    policyVersionId?: true
    status?: true
    source?: true
    decidedAt?: true
    recordedAt?: true
  }

  export type ConsentRecordCountAggregateInputType = {
    id?: true
    organisationId?: true
    siteId?: true
    principalId?: true
    purposeId?: true
    noticeId?: true
    policyVersionId?: true
    status?: true
    source?: true
    decidedAt?: true
    recordedAt?: true
    metadata?: true
    _all?: true
  }

  export type ConsentRecordAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ConsentRecord to aggregate.
     */
    where?: ConsentRecordWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ConsentRecords to fetch.
     */
    orderBy?: ConsentRecordOrderByWithRelationInput | ConsentRecordOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ConsentRecordWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ConsentRecords from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ConsentRecords.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ConsentRecords
    **/
    _count?: true | ConsentRecordCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ConsentRecordMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ConsentRecordMaxAggregateInputType
  }

  export type GetConsentRecordAggregateType<T extends ConsentRecordAggregateArgs> = {
        [P in keyof T & keyof AggregateConsentRecord]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateConsentRecord[P]>
      : GetScalarType<T[P], AggregateConsentRecord[P]>
  }




  export type ConsentRecordGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ConsentRecordWhereInput
    orderBy?: ConsentRecordOrderByWithAggregationInput | ConsentRecordOrderByWithAggregationInput[]
    by: ConsentRecordScalarFieldEnum[] | ConsentRecordScalarFieldEnum
    having?: ConsentRecordScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ConsentRecordCountAggregateInputType | true
    _min?: ConsentRecordMinAggregateInputType
    _max?: ConsentRecordMaxAggregateInputType
  }

  export type ConsentRecordGroupByOutputType = {
    id: string
    organisationId: string
    siteId: string
    principalId: string
    purposeId: string
    noticeId: string | null
    policyVersionId: string | null
    status: string
    source: string
    decidedAt: Date
    recordedAt: Date
    metadata: JsonValue | null
    _count: ConsentRecordCountAggregateOutputType | null
    _min: ConsentRecordMinAggregateOutputType | null
    _max: ConsentRecordMaxAggregateOutputType | null
  }

  type GetConsentRecordGroupByPayload<T extends ConsentRecordGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ConsentRecordGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ConsentRecordGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ConsentRecordGroupByOutputType[P]>
            : GetScalarType<T[P], ConsentRecordGroupByOutputType[P]>
        }
      >
    >


  export type ConsentRecordSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organisationId?: boolean
    siteId?: boolean
    principalId?: boolean
    purposeId?: boolean
    noticeId?: boolean
    policyVersionId?: boolean
    status?: boolean
    source?: boolean
    decidedAt?: boolean
    recordedAt?: boolean
    metadata?: boolean
    website?: boolean | WebsiteDefaultArgs<ExtArgs>
    principal?: boolean | PrincipalDefaultArgs<ExtArgs>
    purpose?: boolean | PurposeDefaultArgs<ExtArgs>
    notice?: boolean | ConsentRecord$noticeArgs<ExtArgs>
    policyVersion?: boolean | ConsentRecord$policyVersionArgs<ExtArgs>
  }, ExtArgs["result"]["consentRecord"]>

  export type ConsentRecordSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organisationId?: boolean
    siteId?: boolean
    principalId?: boolean
    purposeId?: boolean
    noticeId?: boolean
    policyVersionId?: boolean
    status?: boolean
    source?: boolean
    decidedAt?: boolean
    recordedAt?: boolean
    metadata?: boolean
    website?: boolean | WebsiteDefaultArgs<ExtArgs>
    principal?: boolean | PrincipalDefaultArgs<ExtArgs>
    purpose?: boolean | PurposeDefaultArgs<ExtArgs>
    notice?: boolean | ConsentRecord$noticeArgs<ExtArgs>
    policyVersion?: boolean | ConsentRecord$policyVersionArgs<ExtArgs>
  }, ExtArgs["result"]["consentRecord"]>

  export type ConsentRecordSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organisationId?: boolean
    siteId?: boolean
    principalId?: boolean
    purposeId?: boolean
    noticeId?: boolean
    policyVersionId?: boolean
    status?: boolean
    source?: boolean
    decidedAt?: boolean
    recordedAt?: boolean
    metadata?: boolean
    website?: boolean | WebsiteDefaultArgs<ExtArgs>
    principal?: boolean | PrincipalDefaultArgs<ExtArgs>
    purpose?: boolean | PurposeDefaultArgs<ExtArgs>
    notice?: boolean | ConsentRecord$noticeArgs<ExtArgs>
    policyVersion?: boolean | ConsentRecord$policyVersionArgs<ExtArgs>
  }, ExtArgs["result"]["consentRecord"]>

  export type ConsentRecordSelectScalar = {
    id?: boolean
    organisationId?: boolean
    siteId?: boolean
    principalId?: boolean
    purposeId?: boolean
    noticeId?: boolean
    policyVersionId?: boolean
    status?: boolean
    source?: boolean
    decidedAt?: boolean
    recordedAt?: boolean
    metadata?: boolean
  }

  export type ConsentRecordOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "organisationId" | "siteId" | "principalId" | "purposeId" | "noticeId" | "policyVersionId" | "status" | "source" | "decidedAt" | "recordedAt" | "metadata", ExtArgs["result"]["consentRecord"]>
  export type ConsentRecordInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    website?: boolean | WebsiteDefaultArgs<ExtArgs>
    principal?: boolean | PrincipalDefaultArgs<ExtArgs>
    purpose?: boolean | PurposeDefaultArgs<ExtArgs>
    notice?: boolean | ConsentRecord$noticeArgs<ExtArgs>
    policyVersion?: boolean | ConsentRecord$policyVersionArgs<ExtArgs>
  }
  export type ConsentRecordIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    website?: boolean | WebsiteDefaultArgs<ExtArgs>
    principal?: boolean | PrincipalDefaultArgs<ExtArgs>
    purpose?: boolean | PurposeDefaultArgs<ExtArgs>
    notice?: boolean | ConsentRecord$noticeArgs<ExtArgs>
    policyVersion?: boolean | ConsentRecord$policyVersionArgs<ExtArgs>
  }
  export type ConsentRecordIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    website?: boolean | WebsiteDefaultArgs<ExtArgs>
    principal?: boolean | PrincipalDefaultArgs<ExtArgs>
    purpose?: boolean | PurposeDefaultArgs<ExtArgs>
    notice?: boolean | ConsentRecord$noticeArgs<ExtArgs>
    policyVersion?: boolean | ConsentRecord$policyVersionArgs<ExtArgs>
  }

  export type $ConsentRecordPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ConsentRecord"
    objects: {
      website: Prisma.$WebsitePayload<ExtArgs>
      principal: Prisma.$PrincipalPayload<ExtArgs>
      purpose: Prisma.$PurposePayload<ExtArgs>
      notice: Prisma.$NoticePayload<ExtArgs> | null
      policyVersion: Prisma.$PolicyVersionPayload<ExtArgs> | null
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      organisationId: string
      siteId: string
      principalId: string
      purposeId: string
      noticeId: string | null
      /**
       * Snapshot of the policy version in force, so the record stands alone even if
       * the notice is later superseded.
       */
      policyVersionId: string | null
      /**
       * GRANTED | DENIED | WITHDRAWN. A string rather than an enum so new decision
       * types can be added without a type migration; the API validates the set.
       */
      status: string
      /**
       * Where the decision came from, e.g. "sdk", "api", "import".
       */
      source: string
      /**
       * When the principal decided.
       */
      decidedAt: Date
      /**
       * When we durably stored it. Never equal to decidedAt for imported records.
       */
      recordedAt: Date
      /**
       * Free-form context (UI surface, SDK version...). Never legal rules.
       */
      metadata: Prisma.JsonValue | null
    }, ExtArgs["result"]["consentRecord"]>
    composites: {}
  }

  type ConsentRecordGetPayload<S extends boolean | null | undefined | ConsentRecordDefaultArgs> = $Result.GetResult<Prisma.$ConsentRecordPayload, S>

  type ConsentRecordCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<ConsentRecordFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: ConsentRecordCountAggregateInputType | true
    }

  export interface ConsentRecordDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ConsentRecord'], meta: { name: 'ConsentRecord' } }
    /**
     * Find zero or one ConsentRecord that matches the filter.
     * @param {ConsentRecordFindUniqueArgs} args - Arguments to find a ConsentRecord
     * @example
     * // Get one ConsentRecord
     * const consentRecord = await prisma.consentRecord.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ConsentRecordFindUniqueArgs>(args: SelectSubset<T, ConsentRecordFindUniqueArgs<ExtArgs>>): Prisma__ConsentRecordClient<$Result.GetResult<Prisma.$ConsentRecordPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one ConsentRecord that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {ConsentRecordFindUniqueOrThrowArgs} args - Arguments to find a ConsentRecord
     * @example
     * // Get one ConsentRecord
     * const consentRecord = await prisma.consentRecord.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ConsentRecordFindUniqueOrThrowArgs>(args: SelectSubset<T, ConsentRecordFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ConsentRecordClient<$Result.GetResult<Prisma.$ConsentRecordPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ConsentRecord that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ConsentRecordFindFirstArgs} args - Arguments to find a ConsentRecord
     * @example
     * // Get one ConsentRecord
     * const consentRecord = await prisma.consentRecord.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ConsentRecordFindFirstArgs>(args?: SelectSubset<T, ConsentRecordFindFirstArgs<ExtArgs>>): Prisma__ConsentRecordClient<$Result.GetResult<Prisma.$ConsentRecordPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ConsentRecord that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ConsentRecordFindFirstOrThrowArgs} args - Arguments to find a ConsentRecord
     * @example
     * // Get one ConsentRecord
     * const consentRecord = await prisma.consentRecord.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ConsentRecordFindFirstOrThrowArgs>(args?: SelectSubset<T, ConsentRecordFindFirstOrThrowArgs<ExtArgs>>): Prisma__ConsentRecordClient<$Result.GetResult<Prisma.$ConsentRecordPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more ConsentRecords that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ConsentRecordFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ConsentRecords
     * const consentRecords = await prisma.consentRecord.findMany()
     * 
     * // Get first 10 ConsentRecords
     * const consentRecords = await prisma.consentRecord.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const consentRecordWithIdOnly = await prisma.consentRecord.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ConsentRecordFindManyArgs>(args?: SelectSubset<T, ConsentRecordFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ConsentRecordPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a ConsentRecord.
     * @param {ConsentRecordCreateArgs} args - Arguments to create a ConsentRecord.
     * @example
     * // Create one ConsentRecord
     * const ConsentRecord = await prisma.consentRecord.create({
     *   data: {
     *     // ... data to create a ConsentRecord
     *   }
     * })
     * 
     */
    create<T extends ConsentRecordCreateArgs>(args: SelectSubset<T, ConsentRecordCreateArgs<ExtArgs>>): Prisma__ConsentRecordClient<$Result.GetResult<Prisma.$ConsentRecordPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many ConsentRecords.
     * @param {ConsentRecordCreateManyArgs} args - Arguments to create many ConsentRecords.
     * @example
     * // Create many ConsentRecords
     * const consentRecord = await prisma.consentRecord.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ConsentRecordCreateManyArgs>(args?: SelectSubset<T, ConsentRecordCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ConsentRecords and returns the data saved in the database.
     * @param {ConsentRecordCreateManyAndReturnArgs} args - Arguments to create many ConsentRecords.
     * @example
     * // Create many ConsentRecords
     * const consentRecord = await prisma.consentRecord.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ConsentRecords and only return the `id`
     * const consentRecordWithIdOnly = await prisma.consentRecord.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ConsentRecordCreateManyAndReturnArgs>(args?: SelectSubset<T, ConsentRecordCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ConsentRecordPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a ConsentRecord.
     * @param {ConsentRecordDeleteArgs} args - Arguments to delete one ConsentRecord.
     * @example
     * // Delete one ConsentRecord
     * const ConsentRecord = await prisma.consentRecord.delete({
     *   where: {
     *     // ... filter to delete one ConsentRecord
     *   }
     * })
     * 
     */
    delete<T extends ConsentRecordDeleteArgs>(args: SelectSubset<T, ConsentRecordDeleteArgs<ExtArgs>>): Prisma__ConsentRecordClient<$Result.GetResult<Prisma.$ConsentRecordPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one ConsentRecord.
     * @param {ConsentRecordUpdateArgs} args - Arguments to update one ConsentRecord.
     * @example
     * // Update one ConsentRecord
     * const consentRecord = await prisma.consentRecord.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ConsentRecordUpdateArgs>(args: SelectSubset<T, ConsentRecordUpdateArgs<ExtArgs>>): Prisma__ConsentRecordClient<$Result.GetResult<Prisma.$ConsentRecordPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more ConsentRecords.
     * @param {ConsentRecordDeleteManyArgs} args - Arguments to filter ConsentRecords to delete.
     * @example
     * // Delete a few ConsentRecords
     * const { count } = await prisma.consentRecord.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ConsentRecordDeleteManyArgs>(args?: SelectSubset<T, ConsentRecordDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ConsentRecords.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ConsentRecordUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ConsentRecords
     * const consentRecord = await prisma.consentRecord.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ConsentRecordUpdateManyArgs>(args: SelectSubset<T, ConsentRecordUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ConsentRecords and returns the data updated in the database.
     * @param {ConsentRecordUpdateManyAndReturnArgs} args - Arguments to update many ConsentRecords.
     * @example
     * // Update many ConsentRecords
     * const consentRecord = await prisma.consentRecord.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more ConsentRecords and only return the `id`
     * const consentRecordWithIdOnly = await prisma.consentRecord.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends ConsentRecordUpdateManyAndReturnArgs>(args: SelectSubset<T, ConsentRecordUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ConsentRecordPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one ConsentRecord.
     * @param {ConsentRecordUpsertArgs} args - Arguments to update or create a ConsentRecord.
     * @example
     * // Update or create a ConsentRecord
     * const consentRecord = await prisma.consentRecord.upsert({
     *   create: {
     *     // ... data to create a ConsentRecord
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ConsentRecord we want to update
     *   }
     * })
     */
    upsert<T extends ConsentRecordUpsertArgs>(args: SelectSubset<T, ConsentRecordUpsertArgs<ExtArgs>>): Prisma__ConsentRecordClient<$Result.GetResult<Prisma.$ConsentRecordPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of ConsentRecords.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ConsentRecordCountArgs} args - Arguments to filter ConsentRecords to count.
     * @example
     * // Count the number of ConsentRecords
     * const count = await prisma.consentRecord.count({
     *   where: {
     *     // ... the filter for the ConsentRecords we want to count
     *   }
     * })
    **/
    count<T extends ConsentRecordCountArgs>(
      args?: Subset<T, ConsentRecordCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ConsentRecordCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ConsentRecord.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ConsentRecordAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ConsentRecordAggregateArgs>(args: Subset<T, ConsentRecordAggregateArgs>): Prisma.PrismaPromise<GetConsentRecordAggregateType<T>>

    /**
     * Group by ConsentRecord.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ConsentRecordGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ConsentRecordGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ConsentRecordGroupByArgs['orderBy'] }
        : { orderBy?: ConsentRecordGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ConsentRecordGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetConsentRecordGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ConsentRecord model
   */
  readonly fields: ConsentRecordFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ConsentRecord.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ConsentRecordClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    website<T extends WebsiteDefaultArgs<ExtArgs> = {}>(args?: Subset<T, WebsiteDefaultArgs<ExtArgs>>): Prisma__WebsiteClient<$Result.GetResult<Prisma.$WebsitePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    principal<T extends PrincipalDefaultArgs<ExtArgs> = {}>(args?: Subset<T, PrincipalDefaultArgs<ExtArgs>>): Prisma__PrincipalClient<$Result.GetResult<Prisma.$PrincipalPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    purpose<T extends PurposeDefaultArgs<ExtArgs> = {}>(args?: Subset<T, PurposeDefaultArgs<ExtArgs>>): Prisma__PurposeClient<$Result.GetResult<Prisma.$PurposePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    notice<T extends ConsentRecord$noticeArgs<ExtArgs> = {}>(args?: Subset<T, ConsentRecord$noticeArgs<ExtArgs>>): Prisma__NoticeClient<$Result.GetResult<Prisma.$NoticePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    policyVersion<T extends ConsentRecord$policyVersionArgs<ExtArgs> = {}>(args?: Subset<T, ConsentRecord$policyVersionArgs<ExtArgs>>): Prisma__PolicyVersionClient<$Result.GetResult<Prisma.$PolicyVersionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ConsentRecord model
   */
  interface ConsentRecordFieldRefs {
    readonly id: FieldRef<"ConsentRecord", 'String'>
    readonly organisationId: FieldRef<"ConsentRecord", 'String'>
    readonly siteId: FieldRef<"ConsentRecord", 'String'>
    readonly principalId: FieldRef<"ConsentRecord", 'String'>
    readonly purposeId: FieldRef<"ConsentRecord", 'String'>
    readonly noticeId: FieldRef<"ConsentRecord", 'String'>
    readonly policyVersionId: FieldRef<"ConsentRecord", 'String'>
    readonly status: FieldRef<"ConsentRecord", 'String'>
    readonly source: FieldRef<"ConsentRecord", 'String'>
    readonly decidedAt: FieldRef<"ConsentRecord", 'DateTime'>
    readonly recordedAt: FieldRef<"ConsentRecord", 'DateTime'>
    readonly metadata: FieldRef<"ConsentRecord", 'Json'>
  }
    

  // Custom InputTypes
  /**
   * ConsentRecord findUnique
   */
  export type ConsentRecordFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConsentRecord
     */
    select?: ConsentRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ConsentRecord
     */
    omit?: ConsentRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConsentRecordInclude<ExtArgs> | null
    /**
     * Filter, which ConsentRecord to fetch.
     */
    where: ConsentRecordWhereUniqueInput
  }

  /**
   * ConsentRecord findUniqueOrThrow
   */
  export type ConsentRecordFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConsentRecord
     */
    select?: ConsentRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ConsentRecord
     */
    omit?: ConsentRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConsentRecordInclude<ExtArgs> | null
    /**
     * Filter, which ConsentRecord to fetch.
     */
    where: ConsentRecordWhereUniqueInput
  }

  /**
   * ConsentRecord findFirst
   */
  export type ConsentRecordFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConsentRecord
     */
    select?: ConsentRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ConsentRecord
     */
    omit?: ConsentRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConsentRecordInclude<ExtArgs> | null
    /**
     * Filter, which ConsentRecord to fetch.
     */
    where?: ConsentRecordWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ConsentRecords to fetch.
     */
    orderBy?: ConsentRecordOrderByWithRelationInput | ConsentRecordOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ConsentRecords.
     */
    cursor?: ConsentRecordWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ConsentRecords from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ConsentRecords.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ConsentRecords.
     */
    distinct?: ConsentRecordScalarFieldEnum | ConsentRecordScalarFieldEnum[]
  }

  /**
   * ConsentRecord findFirstOrThrow
   */
  export type ConsentRecordFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConsentRecord
     */
    select?: ConsentRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ConsentRecord
     */
    omit?: ConsentRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConsentRecordInclude<ExtArgs> | null
    /**
     * Filter, which ConsentRecord to fetch.
     */
    where?: ConsentRecordWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ConsentRecords to fetch.
     */
    orderBy?: ConsentRecordOrderByWithRelationInput | ConsentRecordOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ConsentRecords.
     */
    cursor?: ConsentRecordWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ConsentRecords from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ConsentRecords.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ConsentRecords.
     */
    distinct?: ConsentRecordScalarFieldEnum | ConsentRecordScalarFieldEnum[]
  }

  /**
   * ConsentRecord findMany
   */
  export type ConsentRecordFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConsentRecord
     */
    select?: ConsentRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ConsentRecord
     */
    omit?: ConsentRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConsentRecordInclude<ExtArgs> | null
    /**
     * Filter, which ConsentRecords to fetch.
     */
    where?: ConsentRecordWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ConsentRecords to fetch.
     */
    orderBy?: ConsentRecordOrderByWithRelationInput | ConsentRecordOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ConsentRecords.
     */
    cursor?: ConsentRecordWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ConsentRecords from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ConsentRecords.
     */
    skip?: number
    distinct?: ConsentRecordScalarFieldEnum | ConsentRecordScalarFieldEnum[]
  }

  /**
   * ConsentRecord create
   */
  export type ConsentRecordCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConsentRecord
     */
    select?: ConsentRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ConsentRecord
     */
    omit?: ConsentRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConsentRecordInclude<ExtArgs> | null
    /**
     * The data needed to create a ConsentRecord.
     */
    data: XOR<ConsentRecordCreateInput, ConsentRecordUncheckedCreateInput>
  }

  /**
   * ConsentRecord createMany
   */
  export type ConsentRecordCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ConsentRecords.
     */
    data: ConsentRecordCreateManyInput | ConsentRecordCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ConsentRecord createManyAndReturn
   */
  export type ConsentRecordCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConsentRecord
     */
    select?: ConsentRecordSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ConsentRecord
     */
    omit?: ConsentRecordOmit<ExtArgs> | null
    /**
     * The data used to create many ConsentRecords.
     */
    data: ConsentRecordCreateManyInput | ConsentRecordCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConsentRecordIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * ConsentRecord update
   */
  export type ConsentRecordUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConsentRecord
     */
    select?: ConsentRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ConsentRecord
     */
    omit?: ConsentRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConsentRecordInclude<ExtArgs> | null
    /**
     * The data needed to update a ConsentRecord.
     */
    data: XOR<ConsentRecordUpdateInput, ConsentRecordUncheckedUpdateInput>
    /**
     * Choose, which ConsentRecord to update.
     */
    where: ConsentRecordWhereUniqueInput
  }

  /**
   * ConsentRecord updateMany
   */
  export type ConsentRecordUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ConsentRecords.
     */
    data: XOR<ConsentRecordUpdateManyMutationInput, ConsentRecordUncheckedUpdateManyInput>
    /**
     * Filter which ConsentRecords to update
     */
    where?: ConsentRecordWhereInput
    /**
     * Limit how many ConsentRecords to update.
     */
    limit?: number
  }

  /**
   * ConsentRecord updateManyAndReturn
   */
  export type ConsentRecordUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConsentRecord
     */
    select?: ConsentRecordSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ConsentRecord
     */
    omit?: ConsentRecordOmit<ExtArgs> | null
    /**
     * The data used to update ConsentRecords.
     */
    data: XOR<ConsentRecordUpdateManyMutationInput, ConsentRecordUncheckedUpdateManyInput>
    /**
     * Filter which ConsentRecords to update
     */
    where?: ConsentRecordWhereInput
    /**
     * Limit how many ConsentRecords to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConsentRecordIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * ConsentRecord upsert
   */
  export type ConsentRecordUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConsentRecord
     */
    select?: ConsentRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ConsentRecord
     */
    omit?: ConsentRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConsentRecordInclude<ExtArgs> | null
    /**
     * The filter to search for the ConsentRecord to update in case it exists.
     */
    where: ConsentRecordWhereUniqueInput
    /**
     * In case the ConsentRecord found by the `where` argument doesn't exist, create a new ConsentRecord with this data.
     */
    create: XOR<ConsentRecordCreateInput, ConsentRecordUncheckedCreateInput>
    /**
     * In case the ConsentRecord was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ConsentRecordUpdateInput, ConsentRecordUncheckedUpdateInput>
  }

  /**
   * ConsentRecord delete
   */
  export type ConsentRecordDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConsentRecord
     */
    select?: ConsentRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ConsentRecord
     */
    omit?: ConsentRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConsentRecordInclude<ExtArgs> | null
    /**
     * Filter which ConsentRecord to delete.
     */
    where: ConsentRecordWhereUniqueInput
  }

  /**
   * ConsentRecord deleteMany
   */
  export type ConsentRecordDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ConsentRecords to delete
     */
    where?: ConsentRecordWhereInput
    /**
     * Limit how many ConsentRecords to delete.
     */
    limit?: number
  }

  /**
   * ConsentRecord.notice
   */
  export type ConsentRecord$noticeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Notice
     */
    select?: NoticeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Notice
     */
    omit?: NoticeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: NoticeInclude<ExtArgs> | null
    where?: NoticeWhereInput
  }

  /**
   * ConsentRecord.policyVersion
   */
  export type ConsentRecord$policyVersionArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PolicyVersion
     */
    select?: PolicyVersionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PolicyVersion
     */
    omit?: PolicyVersionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PolicyVersionInclude<ExtArgs> | null
    where?: PolicyVersionWhereInput
  }

  /**
   * ConsentRecord without action
   */
  export type ConsentRecordDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConsentRecord
     */
    select?: ConsentRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ConsentRecord
     */
    omit?: ConsentRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConsentRecordInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const OrganisationScalarFieldEnum: {
    id: 'id',
    name: 'name',
    slug: 'slug',
    secretKeyHash: 'secretKeyHash',
    createdAt: 'createdAt'
  };

  export type OrganisationScalarFieldEnum = (typeof OrganisationScalarFieldEnum)[keyof typeof OrganisationScalarFieldEnum]


  export const WebsiteScalarFieldEnum: {
    id: 'id',
    organisationId: 'organisationId',
    name: 'name',
    domain: 'domain',
    publicKey: 'publicKey',
    isActive: 'isActive',
    createdAt: 'createdAt'
  };

  export type WebsiteScalarFieldEnum = (typeof WebsiteScalarFieldEnum)[keyof typeof WebsiteScalarFieldEnum]


  export const SessionScalarFieldEnum: {
    id: 'id',
    siteId: 'siteId',
    startedAt: 'startedAt',
    lastActivity: 'lastActivity'
  };

  export type SessionScalarFieldEnum = (typeof SessionScalarFieldEnum)[keyof typeof SessionScalarFieldEnum]


  export const EventScalarFieldEnum: {
    id: 'id',
    eventId: 'eventId',
    siteId: 'siteId',
    sessionId: 'sessionId',
    eventType: 'eventType',
    name: 'name',
    eventTime: 'eventTime',
    pageUrl: 'pageUrl',
    pageTitle: 'pageTitle',
    referrer: 'referrer',
    deviceType: 'deviceType',
    browser: 'browser',
    os: 'os',
    properties: 'properties',
    receivedAt: 'receivedAt'
  };

  export type EventScalarFieldEnum = (typeof EventScalarFieldEnum)[keyof typeof EventScalarFieldEnum]


  export const PrincipalScalarFieldEnum: {
    id: 'id',
    siteId: 'siteId',
    externalId: 'externalId',
    kind: 'kind',
    createdAt: 'createdAt'
  };

  export type PrincipalScalarFieldEnum = (typeof PrincipalScalarFieldEnum)[keyof typeof PrincipalScalarFieldEnum]


  export const PurposeScalarFieldEnum: {
    id: 'id',
    organisationId: 'organisationId',
    code: 'code',
    name: 'name',
    description: 'description',
    isActive: 'isActive',
    createdAt: 'createdAt'
  };

  export type PurposeScalarFieldEnum = (typeof PurposeScalarFieldEnum)[keyof typeof PurposeScalarFieldEnum]


  export const PolicyScalarFieldEnum: {
    id: 'id',
    organisationId: 'organisationId',
    code: 'code',
    name: 'name',
    createdAt: 'createdAt'
  };

  export type PolicyScalarFieldEnum = (typeof PolicyScalarFieldEnum)[keyof typeof PolicyScalarFieldEnum]


  export const PolicyVersionScalarFieldEnum: {
    id: 'id',
    organisationId: 'organisationId',
    policyId: 'policyId',
    version: 'version',
    documentUrl: 'documentUrl',
    contentHash: 'contentHash',
    publishedAt: 'publishedAt'
  };

  export type PolicyVersionScalarFieldEnum = (typeof PolicyVersionScalarFieldEnum)[keyof typeof PolicyVersionScalarFieldEnum]


  export const NoticeScalarFieldEnum: {
    id: 'id',
    organisationId: 'organisationId',
    policyVersionId: 'policyVersionId',
    version: 'version',
    locale: 'locale',
    publishedAt: 'publishedAt'
  };

  export type NoticeScalarFieldEnum = (typeof NoticeScalarFieldEnum)[keyof typeof NoticeScalarFieldEnum]


  export const NoticePurposeScalarFieldEnum: {
    noticeId: 'noticeId',
    purposeId: 'purposeId'
  };

  export type NoticePurposeScalarFieldEnum = (typeof NoticePurposeScalarFieldEnum)[keyof typeof NoticePurposeScalarFieldEnum]


  export const ConsentRecordScalarFieldEnum: {
    id: 'id',
    organisationId: 'organisationId',
    siteId: 'siteId',
    principalId: 'principalId',
    purposeId: 'purposeId',
    noticeId: 'noticeId',
    policyVersionId: 'policyVersionId',
    status: 'status',
    source: 'source',
    decidedAt: 'decidedAt',
    recordedAt: 'recordedAt',
    metadata: 'metadata'
  };

  export type ConsentRecordScalarFieldEnum = (typeof ConsentRecordScalarFieldEnum)[keyof typeof ConsentRecordScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const NullableJsonNullValueInput: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull
  };

  export type NullableJsonNullValueInput = (typeof NullableJsonNullValueInput)[keyof typeof NullableJsonNullValueInput]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const JsonNullValueFilter: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull,
    AnyNull: typeof AnyNull
  };

  export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'Json'
   */
  export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Json'>
    


  /**
   * Reference to a field of type 'QueryMode'
   */
  export type EnumQueryModeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'QueryMode'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    
  /**
   * Deep Input Types
   */


  export type OrganisationWhereInput = {
    AND?: OrganisationWhereInput | OrganisationWhereInput[]
    OR?: OrganisationWhereInput[]
    NOT?: OrganisationWhereInput | OrganisationWhereInput[]
    id?: StringFilter<"Organisation"> | string
    name?: StringFilter<"Organisation"> | string
    slug?: StringFilter<"Organisation"> | string
    secretKeyHash?: StringFilter<"Organisation"> | string
    createdAt?: DateTimeFilter<"Organisation"> | Date | string
    websites?: WebsiteListRelationFilter
    purposes?: PurposeListRelationFilter
    policies?: PolicyListRelationFilter
    notices?: NoticeListRelationFilter
  }

  export type OrganisationOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    slug?: SortOrder
    secretKeyHash?: SortOrder
    createdAt?: SortOrder
    websites?: WebsiteOrderByRelationAggregateInput
    purposes?: PurposeOrderByRelationAggregateInput
    policies?: PolicyOrderByRelationAggregateInput
    notices?: NoticeOrderByRelationAggregateInput
  }

  export type OrganisationWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    slug?: string
    secretKeyHash?: string
    AND?: OrganisationWhereInput | OrganisationWhereInput[]
    OR?: OrganisationWhereInput[]
    NOT?: OrganisationWhereInput | OrganisationWhereInput[]
    name?: StringFilter<"Organisation"> | string
    createdAt?: DateTimeFilter<"Organisation"> | Date | string
    websites?: WebsiteListRelationFilter
    purposes?: PurposeListRelationFilter
    policies?: PolicyListRelationFilter
    notices?: NoticeListRelationFilter
  }, "id" | "slug" | "secretKeyHash">

  export type OrganisationOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    slug?: SortOrder
    secretKeyHash?: SortOrder
    createdAt?: SortOrder
    _count?: OrganisationCountOrderByAggregateInput
    _max?: OrganisationMaxOrderByAggregateInput
    _min?: OrganisationMinOrderByAggregateInput
  }

  export type OrganisationScalarWhereWithAggregatesInput = {
    AND?: OrganisationScalarWhereWithAggregatesInput | OrganisationScalarWhereWithAggregatesInput[]
    OR?: OrganisationScalarWhereWithAggregatesInput[]
    NOT?: OrganisationScalarWhereWithAggregatesInput | OrganisationScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Organisation"> | string
    name?: StringWithAggregatesFilter<"Organisation"> | string
    slug?: StringWithAggregatesFilter<"Organisation"> | string
    secretKeyHash?: StringWithAggregatesFilter<"Organisation"> | string
    createdAt?: DateTimeWithAggregatesFilter<"Organisation"> | Date | string
  }

  export type WebsiteWhereInput = {
    AND?: WebsiteWhereInput | WebsiteWhereInput[]
    OR?: WebsiteWhereInput[]
    NOT?: WebsiteWhereInput | WebsiteWhereInput[]
    id?: StringFilter<"Website"> | string
    organisationId?: StringFilter<"Website"> | string
    name?: StringFilter<"Website"> | string
    domain?: StringFilter<"Website"> | string
    publicKey?: StringFilter<"Website"> | string
    isActive?: BoolFilter<"Website"> | boolean
    createdAt?: DateTimeFilter<"Website"> | Date | string
    organisation?: XOR<OrganisationScalarRelationFilter, OrganisationWhereInput>
    sessions?: SessionListRelationFilter
    events?: EventListRelationFilter
    principals?: PrincipalListRelationFilter
    consentRecords?: ConsentRecordListRelationFilter
  }

  export type WebsiteOrderByWithRelationInput = {
    id?: SortOrder
    organisationId?: SortOrder
    name?: SortOrder
    domain?: SortOrder
    publicKey?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    organisation?: OrganisationOrderByWithRelationInput
    sessions?: SessionOrderByRelationAggregateInput
    events?: EventOrderByRelationAggregateInput
    principals?: PrincipalOrderByRelationAggregateInput
    consentRecords?: ConsentRecordOrderByRelationAggregateInput
  }

  export type WebsiteWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    publicKey?: string
    id_organisationId?: WebsiteIdOrganisationIdCompoundUniqueInput
    AND?: WebsiteWhereInput | WebsiteWhereInput[]
    OR?: WebsiteWhereInput[]
    NOT?: WebsiteWhereInput | WebsiteWhereInput[]
    organisationId?: StringFilter<"Website"> | string
    name?: StringFilter<"Website"> | string
    domain?: StringFilter<"Website"> | string
    isActive?: BoolFilter<"Website"> | boolean
    createdAt?: DateTimeFilter<"Website"> | Date | string
    organisation?: XOR<OrganisationScalarRelationFilter, OrganisationWhereInput>
    sessions?: SessionListRelationFilter
    events?: EventListRelationFilter
    principals?: PrincipalListRelationFilter
    consentRecords?: ConsentRecordListRelationFilter
  }, "id" | "publicKey" | "id_organisationId">

  export type WebsiteOrderByWithAggregationInput = {
    id?: SortOrder
    organisationId?: SortOrder
    name?: SortOrder
    domain?: SortOrder
    publicKey?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    _count?: WebsiteCountOrderByAggregateInput
    _max?: WebsiteMaxOrderByAggregateInput
    _min?: WebsiteMinOrderByAggregateInput
  }

  export type WebsiteScalarWhereWithAggregatesInput = {
    AND?: WebsiteScalarWhereWithAggregatesInput | WebsiteScalarWhereWithAggregatesInput[]
    OR?: WebsiteScalarWhereWithAggregatesInput[]
    NOT?: WebsiteScalarWhereWithAggregatesInput | WebsiteScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Website"> | string
    organisationId?: StringWithAggregatesFilter<"Website"> | string
    name?: StringWithAggregatesFilter<"Website"> | string
    domain?: StringWithAggregatesFilter<"Website"> | string
    publicKey?: StringWithAggregatesFilter<"Website"> | string
    isActive?: BoolWithAggregatesFilter<"Website"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"Website"> | Date | string
  }

  export type SessionWhereInput = {
    AND?: SessionWhereInput | SessionWhereInput[]
    OR?: SessionWhereInput[]
    NOT?: SessionWhereInput | SessionWhereInput[]
    id?: StringFilter<"Session"> | string
    siteId?: StringFilter<"Session"> | string
    startedAt?: DateTimeFilter<"Session"> | Date | string
    lastActivity?: DateTimeFilter<"Session"> | Date | string
    website?: XOR<WebsiteScalarRelationFilter, WebsiteWhereInput>
    events?: EventListRelationFilter
  }

  export type SessionOrderByWithRelationInput = {
    id?: SortOrder
    siteId?: SortOrder
    startedAt?: SortOrder
    lastActivity?: SortOrder
    website?: WebsiteOrderByWithRelationInput
    events?: EventOrderByRelationAggregateInput
  }

  export type SessionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    id_siteId?: SessionIdSiteIdCompoundUniqueInput
    AND?: SessionWhereInput | SessionWhereInput[]
    OR?: SessionWhereInput[]
    NOT?: SessionWhereInput | SessionWhereInput[]
    siteId?: StringFilter<"Session"> | string
    startedAt?: DateTimeFilter<"Session"> | Date | string
    lastActivity?: DateTimeFilter<"Session"> | Date | string
    website?: XOR<WebsiteScalarRelationFilter, WebsiteWhereInput>
    events?: EventListRelationFilter
  }, "id" | "id_siteId">

  export type SessionOrderByWithAggregationInput = {
    id?: SortOrder
    siteId?: SortOrder
    startedAt?: SortOrder
    lastActivity?: SortOrder
    _count?: SessionCountOrderByAggregateInput
    _max?: SessionMaxOrderByAggregateInput
    _min?: SessionMinOrderByAggregateInput
  }

  export type SessionScalarWhereWithAggregatesInput = {
    AND?: SessionScalarWhereWithAggregatesInput | SessionScalarWhereWithAggregatesInput[]
    OR?: SessionScalarWhereWithAggregatesInput[]
    NOT?: SessionScalarWhereWithAggregatesInput | SessionScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Session"> | string
    siteId?: StringWithAggregatesFilter<"Session"> | string
    startedAt?: DateTimeWithAggregatesFilter<"Session"> | Date | string
    lastActivity?: DateTimeWithAggregatesFilter<"Session"> | Date | string
  }

  export type EventWhereInput = {
    AND?: EventWhereInput | EventWhereInput[]
    OR?: EventWhereInput[]
    NOT?: EventWhereInput | EventWhereInput[]
    id?: StringFilter<"Event"> | string
    eventId?: StringFilter<"Event"> | string
    siteId?: StringFilter<"Event"> | string
    sessionId?: StringFilter<"Event"> | string
    eventType?: StringFilter<"Event"> | string
    name?: StringNullableFilter<"Event"> | string | null
    eventTime?: DateTimeFilter<"Event"> | Date | string
    pageUrl?: StringFilter<"Event"> | string
    pageTitle?: StringFilter<"Event"> | string
    referrer?: StringNullableFilter<"Event"> | string | null
    deviceType?: StringFilter<"Event"> | string
    browser?: StringFilter<"Event"> | string
    os?: StringFilter<"Event"> | string
    properties?: JsonNullableFilter<"Event">
    receivedAt?: DateTimeFilter<"Event"> | Date | string
    website?: XOR<WebsiteScalarRelationFilter, WebsiteWhereInput>
    session?: XOR<SessionScalarRelationFilter, SessionWhereInput>
  }

  export type EventOrderByWithRelationInput = {
    id?: SortOrder
    eventId?: SortOrder
    siteId?: SortOrder
    sessionId?: SortOrder
    eventType?: SortOrder
    name?: SortOrderInput | SortOrder
    eventTime?: SortOrder
    pageUrl?: SortOrder
    pageTitle?: SortOrder
    referrer?: SortOrderInput | SortOrder
    deviceType?: SortOrder
    browser?: SortOrder
    os?: SortOrder
    properties?: SortOrderInput | SortOrder
    receivedAt?: SortOrder
    website?: WebsiteOrderByWithRelationInput
    session?: SessionOrderByWithRelationInput
  }

  export type EventWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    eventId?: string
    AND?: EventWhereInput | EventWhereInput[]
    OR?: EventWhereInput[]
    NOT?: EventWhereInput | EventWhereInput[]
    siteId?: StringFilter<"Event"> | string
    sessionId?: StringFilter<"Event"> | string
    eventType?: StringFilter<"Event"> | string
    name?: StringNullableFilter<"Event"> | string | null
    eventTime?: DateTimeFilter<"Event"> | Date | string
    pageUrl?: StringFilter<"Event"> | string
    pageTitle?: StringFilter<"Event"> | string
    referrer?: StringNullableFilter<"Event"> | string | null
    deviceType?: StringFilter<"Event"> | string
    browser?: StringFilter<"Event"> | string
    os?: StringFilter<"Event"> | string
    properties?: JsonNullableFilter<"Event">
    receivedAt?: DateTimeFilter<"Event"> | Date | string
    website?: XOR<WebsiteScalarRelationFilter, WebsiteWhereInput>
    session?: XOR<SessionScalarRelationFilter, SessionWhereInput>
  }, "id" | "eventId">

  export type EventOrderByWithAggregationInput = {
    id?: SortOrder
    eventId?: SortOrder
    siteId?: SortOrder
    sessionId?: SortOrder
    eventType?: SortOrder
    name?: SortOrderInput | SortOrder
    eventTime?: SortOrder
    pageUrl?: SortOrder
    pageTitle?: SortOrder
    referrer?: SortOrderInput | SortOrder
    deviceType?: SortOrder
    browser?: SortOrder
    os?: SortOrder
    properties?: SortOrderInput | SortOrder
    receivedAt?: SortOrder
    _count?: EventCountOrderByAggregateInput
    _max?: EventMaxOrderByAggregateInput
    _min?: EventMinOrderByAggregateInput
  }

  export type EventScalarWhereWithAggregatesInput = {
    AND?: EventScalarWhereWithAggregatesInput | EventScalarWhereWithAggregatesInput[]
    OR?: EventScalarWhereWithAggregatesInput[]
    NOT?: EventScalarWhereWithAggregatesInput | EventScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Event"> | string
    eventId?: StringWithAggregatesFilter<"Event"> | string
    siteId?: StringWithAggregatesFilter<"Event"> | string
    sessionId?: StringWithAggregatesFilter<"Event"> | string
    eventType?: StringWithAggregatesFilter<"Event"> | string
    name?: StringNullableWithAggregatesFilter<"Event"> | string | null
    eventTime?: DateTimeWithAggregatesFilter<"Event"> | Date | string
    pageUrl?: StringWithAggregatesFilter<"Event"> | string
    pageTitle?: StringWithAggregatesFilter<"Event"> | string
    referrer?: StringNullableWithAggregatesFilter<"Event"> | string | null
    deviceType?: StringWithAggregatesFilter<"Event"> | string
    browser?: StringWithAggregatesFilter<"Event"> | string
    os?: StringWithAggregatesFilter<"Event"> | string
    properties?: JsonNullableWithAggregatesFilter<"Event">
    receivedAt?: DateTimeWithAggregatesFilter<"Event"> | Date | string
  }

  export type PrincipalWhereInput = {
    AND?: PrincipalWhereInput | PrincipalWhereInput[]
    OR?: PrincipalWhereInput[]
    NOT?: PrincipalWhereInput | PrincipalWhereInput[]
    id?: StringFilter<"Principal"> | string
    siteId?: StringFilter<"Principal"> | string
    externalId?: StringFilter<"Principal"> | string
    kind?: StringFilter<"Principal"> | string
    createdAt?: DateTimeFilter<"Principal"> | Date | string
    website?: XOR<WebsiteScalarRelationFilter, WebsiteWhereInput>
    consentRecords?: ConsentRecordListRelationFilter
  }

  export type PrincipalOrderByWithRelationInput = {
    id?: SortOrder
    siteId?: SortOrder
    externalId?: SortOrder
    kind?: SortOrder
    createdAt?: SortOrder
    website?: WebsiteOrderByWithRelationInput
    consentRecords?: ConsentRecordOrderByRelationAggregateInput
  }

  export type PrincipalWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    siteId_externalId?: PrincipalSiteIdExternalIdCompoundUniqueInput
    id_siteId?: PrincipalIdSiteIdCompoundUniqueInput
    AND?: PrincipalWhereInput | PrincipalWhereInput[]
    OR?: PrincipalWhereInput[]
    NOT?: PrincipalWhereInput | PrincipalWhereInput[]
    siteId?: StringFilter<"Principal"> | string
    externalId?: StringFilter<"Principal"> | string
    kind?: StringFilter<"Principal"> | string
    createdAt?: DateTimeFilter<"Principal"> | Date | string
    website?: XOR<WebsiteScalarRelationFilter, WebsiteWhereInput>
    consentRecords?: ConsentRecordListRelationFilter
  }, "id" | "siteId_externalId" | "id_siteId">

  export type PrincipalOrderByWithAggregationInput = {
    id?: SortOrder
    siteId?: SortOrder
    externalId?: SortOrder
    kind?: SortOrder
    createdAt?: SortOrder
    _count?: PrincipalCountOrderByAggregateInput
    _max?: PrincipalMaxOrderByAggregateInput
    _min?: PrincipalMinOrderByAggregateInput
  }

  export type PrincipalScalarWhereWithAggregatesInput = {
    AND?: PrincipalScalarWhereWithAggregatesInput | PrincipalScalarWhereWithAggregatesInput[]
    OR?: PrincipalScalarWhereWithAggregatesInput[]
    NOT?: PrincipalScalarWhereWithAggregatesInput | PrincipalScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Principal"> | string
    siteId?: StringWithAggregatesFilter<"Principal"> | string
    externalId?: StringWithAggregatesFilter<"Principal"> | string
    kind?: StringWithAggregatesFilter<"Principal"> | string
    createdAt?: DateTimeWithAggregatesFilter<"Principal"> | Date | string
  }

  export type PurposeWhereInput = {
    AND?: PurposeWhereInput | PurposeWhereInput[]
    OR?: PurposeWhereInput[]
    NOT?: PurposeWhereInput | PurposeWhereInput[]
    id?: StringFilter<"Purpose"> | string
    organisationId?: StringFilter<"Purpose"> | string
    code?: StringFilter<"Purpose"> | string
    name?: StringFilter<"Purpose"> | string
    description?: StringFilter<"Purpose"> | string
    isActive?: BoolFilter<"Purpose"> | boolean
    createdAt?: DateTimeFilter<"Purpose"> | Date | string
    organisation?: XOR<OrganisationScalarRelationFilter, OrganisationWhereInput>
    noticePurposes?: NoticePurposeListRelationFilter
    consentRecords?: ConsentRecordListRelationFilter
  }

  export type PurposeOrderByWithRelationInput = {
    id?: SortOrder
    organisationId?: SortOrder
    code?: SortOrder
    name?: SortOrder
    description?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    organisation?: OrganisationOrderByWithRelationInput
    noticePurposes?: NoticePurposeOrderByRelationAggregateInput
    consentRecords?: ConsentRecordOrderByRelationAggregateInput
  }

  export type PurposeWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    organisationId_code?: PurposeOrganisationIdCodeCompoundUniqueInput
    id_organisationId?: PurposeIdOrganisationIdCompoundUniqueInput
    AND?: PurposeWhereInput | PurposeWhereInput[]
    OR?: PurposeWhereInput[]
    NOT?: PurposeWhereInput | PurposeWhereInput[]
    organisationId?: StringFilter<"Purpose"> | string
    code?: StringFilter<"Purpose"> | string
    name?: StringFilter<"Purpose"> | string
    description?: StringFilter<"Purpose"> | string
    isActive?: BoolFilter<"Purpose"> | boolean
    createdAt?: DateTimeFilter<"Purpose"> | Date | string
    organisation?: XOR<OrganisationScalarRelationFilter, OrganisationWhereInput>
    noticePurposes?: NoticePurposeListRelationFilter
    consentRecords?: ConsentRecordListRelationFilter
  }, "id" | "organisationId_code" | "id_organisationId">

  export type PurposeOrderByWithAggregationInput = {
    id?: SortOrder
    organisationId?: SortOrder
    code?: SortOrder
    name?: SortOrder
    description?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    _count?: PurposeCountOrderByAggregateInput
    _max?: PurposeMaxOrderByAggregateInput
    _min?: PurposeMinOrderByAggregateInput
  }

  export type PurposeScalarWhereWithAggregatesInput = {
    AND?: PurposeScalarWhereWithAggregatesInput | PurposeScalarWhereWithAggregatesInput[]
    OR?: PurposeScalarWhereWithAggregatesInput[]
    NOT?: PurposeScalarWhereWithAggregatesInput | PurposeScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Purpose"> | string
    organisationId?: StringWithAggregatesFilter<"Purpose"> | string
    code?: StringWithAggregatesFilter<"Purpose"> | string
    name?: StringWithAggregatesFilter<"Purpose"> | string
    description?: StringWithAggregatesFilter<"Purpose"> | string
    isActive?: BoolWithAggregatesFilter<"Purpose"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"Purpose"> | Date | string
  }

  export type PolicyWhereInput = {
    AND?: PolicyWhereInput | PolicyWhereInput[]
    OR?: PolicyWhereInput[]
    NOT?: PolicyWhereInput | PolicyWhereInput[]
    id?: StringFilter<"Policy"> | string
    organisationId?: StringFilter<"Policy"> | string
    code?: StringFilter<"Policy"> | string
    name?: StringFilter<"Policy"> | string
    createdAt?: DateTimeFilter<"Policy"> | Date | string
    organisation?: XOR<OrganisationScalarRelationFilter, OrganisationWhereInput>
    versions?: PolicyVersionListRelationFilter
  }

  export type PolicyOrderByWithRelationInput = {
    id?: SortOrder
    organisationId?: SortOrder
    code?: SortOrder
    name?: SortOrder
    createdAt?: SortOrder
    organisation?: OrganisationOrderByWithRelationInput
    versions?: PolicyVersionOrderByRelationAggregateInput
  }

  export type PolicyWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    organisationId_code?: PolicyOrganisationIdCodeCompoundUniqueInput
    id_organisationId?: PolicyIdOrganisationIdCompoundUniqueInput
    AND?: PolicyWhereInput | PolicyWhereInput[]
    OR?: PolicyWhereInput[]
    NOT?: PolicyWhereInput | PolicyWhereInput[]
    organisationId?: StringFilter<"Policy"> | string
    code?: StringFilter<"Policy"> | string
    name?: StringFilter<"Policy"> | string
    createdAt?: DateTimeFilter<"Policy"> | Date | string
    organisation?: XOR<OrganisationScalarRelationFilter, OrganisationWhereInput>
    versions?: PolicyVersionListRelationFilter
  }, "id" | "organisationId_code" | "id_organisationId">

  export type PolicyOrderByWithAggregationInput = {
    id?: SortOrder
    organisationId?: SortOrder
    code?: SortOrder
    name?: SortOrder
    createdAt?: SortOrder
    _count?: PolicyCountOrderByAggregateInput
    _max?: PolicyMaxOrderByAggregateInput
    _min?: PolicyMinOrderByAggregateInput
  }

  export type PolicyScalarWhereWithAggregatesInput = {
    AND?: PolicyScalarWhereWithAggregatesInput | PolicyScalarWhereWithAggregatesInput[]
    OR?: PolicyScalarWhereWithAggregatesInput[]
    NOT?: PolicyScalarWhereWithAggregatesInput | PolicyScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Policy"> | string
    organisationId?: StringWithAggregatesFilter<"Policy"> | string
    code?: StringWithAggregatesFilter<"Policy"> | string
    name?: StringWithAggregatesFilter<"Policy"> | string
    createdAt?: DateTimeWithAggregatesFilter<"Policy"> | Date | string
  }

  export type PolicyVersionWhereInput = {
    AND?: PolicyVersionWhereInput | PolicyVersionWhereInput[]
    OR?: PolicyVersionWhereInput[]
    NOT?: PolicyVersionWhereInput | PolicyVersionWhereInput[]
    id?: StringFilter<"PolicyVersion"> | string
    organisationId?: StringFilter<"PolicyVersion"> | string
    policyId?: StringFilter<"PolicyVersion"> | string
    version?: StringFilter<"PolicyVersion"> | string
    documentUrl?: StringNullableFilter<"PolicyVersion"> | string | null
    contentHash?: StringNullableFilter<"PolicyVersion"> | string | null
    publishedAt?: DateTimeFilter<"PolicyVersion"> | Date | string
    policy?: XOR<PolicyScalarRelationFilter, PolicyWhereInput>
    notices?: NoticeListRelationFilter
    consentRecords?: ConsentRecordListRelationFilter
  }

  export type PolicyVersionOrderByWithRelationInput = {
    id?: SortOrder
    organisationId?: SortOrder
    policyId?: SortOrder
    version?: SortOrder
    documentUrl?: SortOrderInput | SortOrder
    contentHash?: SortOrderInput | SortOrder
    publishedAt?: SortOrder
    policy?: PolicyOrderByWithRelationInput
    notices?: NoticeOrderByRelationAggregateInput
    consentRecords?: ConsentRecordOrderByRelationAggregateInput
  }

  export type PolicyVersionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    policyId_version?: PolicyVersionPolicyIdVersionCompoundUniqueInput
    id_organisationId?: PolicyVersionIdOrganisationIdCompoundUniqueInput
    AND?: PolicyVersionWhereInput | PolicyVersionWhereInput[]
    OR?: PolicyVersionWhereInput[]
    NOT?: PolicyVersionWhereInput | PolicyVersionWhereInput[]
    organisationId?: StringFilter<"PolicyVersion"> | string
    policyId?: StringFilter<"PolicyVersion"> | string
    version?: StringFilter<"PolicyVersion"> | string
    documentUrl?: StringNullableFilter<"PolicyVersion"> | string | null
    contentHash?: StringNullableFilter<"PolicyVersion"> | string | null
    publishedAt?: DateTimeFilter<"PolicyVersion"> | Date | string
    policy?: XOR<PolicyScalarRelationFilter, PolicyWhereInput>
    notices?: NoticeListRelationFilter
    consentRecords?: ConsentRecordListRelationFilter
  }, "id" | "policyId_version" | "id_organisationId">

  export type PolicyVersionOrderByWithAggregationInput = {
    id?: SortOrder
    organisationId?: SortOrder
    policyId?: SortOrder
    version?: SortOrder
    documentUrl?: SortOrderInput | SortOrder
    contentHash?: SortOrderInput | SortOrder
    publishedAt?: SortOrder
    _count?: PolicyVersionCountOrderByAggregateInput
    _max?: PolicyVersionMaxOrderByAggregateInput
    _min?: PolicyVersionMinOrderByAggregateInput
  }

  export type PolicyVersionScalarWhereWithAggregatesInput = {
    AND?: PolicyVersionScalarWhereWithAggregatesInput | PolicyVersionScalarWhereWithAggregatesInput[]
    OR?: PolicyVersionScalarWhereWithAggregatesInput[]
    NOT?: PolicyVersionScalarWhereWithAggregatesInput | PolicyVersionScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"PolicyVersion"> | string
    organisationId?: StringWithAggregatesFilter<"PolicyVersion"> | string
    policyId?: StringWithAggregatesFilter<"PolicyVersion"> | string
    version?: StringWithAggregatesFilter<"PolicyVersion"> | string
    documentUrl?: StringNullableWithAggregatesFilter<"PolicyVersion"> | string | null
    contentHash?: StringNullableWithAggregatesFilter<"PolicyVersion"> | string | null
    publishedAt?: DateTimeWithAggregatesFilter<"PolicyVersion"> | Date | string
  }

  export type NoticeWhereInput = {
    AND?: NoticeWhereInput | NoticeWhereInput[]
    OR?: NoticeWhereInput[]
    NOT?: NoticeWhereInput | NoticeWhereInput[]
    id?: StringFilter<"Notice"> | string
    organisationId?: StringFilter<"Notice"> | string
    policyVersionId?: StringFilter<"Notice"> | string
    version?: StringFilter<"Notice"> | string
    locale?: StringFilter<"Notice"> | string
    publishedAt?: DateTimeFilter<"Notice"> | Date | string
    organisation?: XOR<OrganisationScalarRelationFilter, OrganisationWhereInput>
    policyVersion?: XOR<PolicyVersionScalarRelationFilter, PolicyVersionWhereInput>
    purposes?: NoticePurposeListRelationFilter
    consentRecords?: ConsentRecordListRelationFilter
  }

  export type NoticeOrderByWithRelationInput = {
    id?: SortOrder
    organisationId?: SortOrder
    policyVersionId?: SortOrder
    version?: SortOrder
    locale?: SortOrder
    publishedAt?: SortOrder
    organisation?: OrganisationOrderByWithRelationInput
    policyVersion?: PolicyVersionOrderByWithRelationInput
    purposes?: NoticePurposeOrderByRelationAggregateInput
    consentRecords?: ConsentRecordOrderByRelationAggregateInput
  }

  export type NoticeWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    organisationId_version_locale?: NoticeOrganisationIdVersionLocaleCompoundUniqueInput
    id_organisationId?: NoticeIdOrganisationIdCompoundUniqueInput
    AND?: NoticeWhereInput | NoticeWhereInput[]
    OR?: NoticeWhereInput[]
    NOT?: NoticeWhereInput | NoticeWhereInput[]
    organisationId?: StringFilter<"Notice"> | string
    policyVersionId?: StringFilter<"Notice"> | string
    version?: StringFilter<"Notice"> | string
    locale?: StringFilter<"Notice"> | string
    publishedAt?: DateTimeFilter<"Notice"> | Date | string
    organisation?: XOR<OrganisationScalarRelationFilter, OrganisationWhereInput>
    policyVersion?: XOR<PolicyVersionScalarRelationFilter, PolicyVersionWhereInput>
    purposes?: NoticePurposeListRelationFilter
    consentRecords?: ConsentRecordListRelationFilter
  }, "id" | "organisationId_version_locale" | "id_organisationId">

  export type NoticeOrderByWithAggregationInput = {
    id?: SortOrder
    organisationId?: SortOrder
    policyVersionId?: SortOrder
    version?: SortOrder
    locale?: SortOrder
    publishedAt?: SortOrder
    _count?: NoticeCountOrderByAggregateInput
    _max?: NoticeMaxOrderByAggregateInput
    _min?: NoticeMinOrderByAggregateInput
  }

  export type NoticeScalarWhereWithAggregatesInput = {
    AND?: NoticeScalarWhereWithAggregatesInput | NoticeScalarWhereWithAggregatesInput[]
    OR?: NoticeScalarWhereWithAggregatesInput[]
    NOT?: NoticeScalarWhereWithAggregatesInput | NoticeScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Notice"> | string
    organisationId?: StringWithAggregatesFilter<"Notice"> | string
    policyVersionId?: StringWithAggregatesFilter<"Notice"> | string
    version?: StringWithAggregatesFilter<"Notice"> | string
    locale?: StringWithAggregatesFilter<"Notice"> | string
    publishedAt?: DateTimeWithAggregatesFilter<"Notice"> | Date | string
  }

  export type NoticePurposeWhereInput = {
    AND?: NoticePurposeWhereInput | NoticePurposeWhereInput[]
    OR?: NoticePurposeWhereInput[]
    NOT?: NoticePurposeWhereInput | NoticePurposeWhereInput[]
    noticeId?: StringFilter<"NoticePurpose"> | string
    purposeId?: StringFilter<"NoticePurpose"> | string
    notice?: XOR<NoticeScalarRelationFilter, NoticeWhereInput>
    purpose?: XOR<PurposeScalarRelationFilter, PurposeWhereInput>
  }

  export type NoticePurposeOrderByWithRelationInput = {
    noticeId?: SortOrder
    purposeId?: SortOrder
    notice?: NoticeOrderByWithRelationInput
    purpose?: PurposeOrderByWithRelationInput
  }

  export type NoticePurposeWhereUniqueInput = Prisma.AtLeast<{
    noticeId_purposeId?: NoticePurposeNoticeIdPurposeIdCompoundUniqueInput
    AND?: NoticePurposeWhereInput | NoticePurposeWhereInput[]
    OR?: NoticePurposeWhereInput[]
    NOT?: NoticePurposeWhereInput | NoticePurposeWhereInput[]
    noticeId?: StringFilter<"NoticePurpose"> | string
    purposeId?: StringFilter<"NoticePurpose"> | string
    notice?: XOR<NoticeScalarRelationFilter, NoticeWhereInput>
    purpose?: XOR<PurposeScalarRelationFilter, PurposeWhereInput>
  }, "noticeId_purposeId">

  export type NoticePurposeOrderByWithAggregationInput = {
    noticeId?: SortOrder
    purposeId?: SortOrder
    _count?: NoticePurposeCountOrderByAggregateInput
    _max?: NoticePurposeMaxOrderByAggregateInput
    _min?: NoticePurposeMinOrderByAggregateInput
  }

  export type NoticePurposeScalarWhereWithAggregatesInput = {
    AND?: NoticePurposeScalarWhereWithAggregatesInput | NoticePurposeScalarWhereWithAggregatesInput[]
    OR?: NoticePurposeScalarWhereWithAggregatesInput[]
    NOT?: NoticePurposeScalarWhereWithAggregatesInput | NoticePurposeScalarWhereWithAggregatesInput[]
    noticeId?: StringWithAggregatesFilter<"NoticePurpose"> | string
    purposeId?: StringWithAggregatesFilter<"NoticePurpose"> | string
  }

  export type ConsentRecordWhereInput = {
    AND?: ConsentRecordWhereInput | ConsentRecordWhereInput[]
    OR?: ConsentRecordWhereInput[]
    NOT?: ConsentRecordWhereInput | ConsentRecordWhereInput[]
    id?: StringFilter<"ConsentRecord"> | string
    organisationId?: StringFilter<"ConsentRecord"> | string
    siteId?: StringFilter<"ConsentRecord"> | string
    principalId?: StringFilter<"ConsentRecord"> | string
    purposeId?: StringFilter<"ConsentRecord"> | string
    noticeId?: StringNullableFilter<"ConsentRecord"> | string | null
    policyVersionId?: StringNullableFilter<"ConsentRecord"> | string | null
    status?: StringFilter<"ConsentRecord"> | string
    source?: StringFilter<"ConsentRecord"> | string
    decidedAt?: DateTimeFilter<"ConsentRecord"> | Date | string
    recordedAt?: DateTimeFilter<"ConsentRecord"> | Date | string
    metadata?: JsonNullableFilter<"ConsentRecord">
    website?: XOR<WebsiteScalarRelationFilter, WebsiteWhereInput>
    principal?: XOR<PrincipalScalarRelationFilter, PrincipalWhereInput>
    purpose?: XOR<PurposeScalarRelationFilter, PurposeWhereInput>
    notice?: XOR<NoticeNullableScalarRelationFilter, NoticeWhereInput> | null
    policyVersion?: XOR<PolicyVersionNullableScalarRelationFilter, PolicyVersionWhereInput> | null
  }

  export type ConsentRecordOrderByWithRelationInput = {
    id?: SortOrder
    organisationId?: SortOrder
    siteId?: SortOrder
    principalId?: SortOrder
    purposeId?: SortOrder
    noticeId?: SortOrderInput | SortOrder
    policyVersionId?: SortOrderInput | SortOrder
    status?: SortOrder
    source?: SortOrder
    decidedAt?: SortOrder
    recordedAt?: SortOrder
    metadata?: SortOrderInput | SortOrder
    website?: WebsiteOrderByWithRelationInput
    principal?: PrincipalOrderByWithRelationInput
    purpose?: PurposeOrderByWithRelationInput
    notice?: NoticeOrderByWithRelationInput
    policyVersion?: PolicyVersionOrderByWithRelationInput
  }

  export type ConsentRecordWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: ConsentRecordWhereInput | ConsentRecordWhereInput[]
    OR?: ConsentRecordWhereInput[]
    NOT?: ConsentRecordWhereInput | ConsentRecordWhereInput[]
    organisationId?: StringFilter<"ConsentRecord"> | string
    siteId?: StringFilter<"ConsentRecord"> | string
    principalId?: StringFilter<"ConsentRecord"> | string
    purposeId?: StringFilter<"ConsentRecord"> | string
    noticeId?: StringNullableFilter<"ConsentRecord"> | string | null
    policyVersionId?: StringNullableFilter<"ConsentRecord"> | string | null
    status?: StringFilter<"ConsentRecord"> | string
    source?: StringFilter<"ConsentRecord"> | string
    decidedAt?: DateTimeFilter<"ConsentRecord"> | Date | string
    recordedAt?: DateTimeFilter<"ConsentRecord"> | Date | string
    metadata?: JsonNullableFilter<"ConsentRecord">
    website?: XOR<WebsiteScalarRelationFilter, WebsiteWhereInput>
    principal?: XOR<PrincipalScalarRelationFilter, PrincipalWhereInput>
    purpose?: XOR<PurposeScalarRelationFilter, PurposeWhereInput>
    notice?: XOR<NoticeNullableScalarRelationFilter, NoticeWhereInput> | null
    policyVersion?: XOR<PolicyVersionNullableScalarRelationFilter, PolicyVersionWhereInput> | null
  }, "id">

  export type ConsentRecordOrderByWithAggregationInput = {
    id?: SortOrder
    organisationId?: SortOrder
    siteId?: SortOrder
    principalId?: SortOrder
    purposeId?: SortOrder
    noticeId?: SortOrderInput | SortOrder
    policyVersionId?: SortOrderInput | SortOrder
    status?: SortOrder
    source?: SortOrder
    decidedAt?: SortOrder
    recordedAt?: SortOrder
    metadata?: SortOrderInput | SortOrder
    _count?: ConsentRecordCountOrderByAggregateInput
    _max?: ConsentRecordMaxOrderByAggregateInput
    _min?: ConsentRecordMinOrderByAggregateInput
  }

  export type ConsentRecordScalarWhereWithAggregatesInput = {
    AND?: ConsentRecordScalarWhereWithAggregatesInput | ConsentRecordScalarWhereWithAggregatesInput[]
    OR?: ConsentRecordScalarWhereWithAggregatesInput[]
    NOT?: ConsentRecordScalarWhereWithAggregatesInput | ConsentRecordScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"ConsentRecord"> | string
    organisationId?: StringWithAggregatesFilter<"ConsentRecord"> | string
    siteId?: StringWithAggregatesFilter<"ConsentRecord"> | string
    principalId?: StringWithAggregatesFilter<"ConsentRecord"> | string
    purposeId?: StringWithAggregatesFilter<"ConsentRecord"> | string
    noticeId?: StringNullableWithAggregatesFilter<"ConsentRecord"> | string | null
    policyVersionId?: StringNullableWithAggregatesFilter<"ConsentRecord"> | string | null
    status?: StringWithAggregatesFilter<"ConsentRecord"> | string
    source?: StringWithAggregatesFilter<"ConsentRecord"> | string
    decidedAt?: DateTimeWithAggregatesFilter<"ConsentRecord"> | Date | string
    recordedAt?: DateTimeWithAggregatesFilter<"ConsentRecord"> | Date | string
    metadata?: JsonNullableWithAggregatesFilter<"ConsentRecord">
  }

  export type OrganisationCreateInput = {
    id?: string
    name: string
    slug: string
    secretKeyHash: string
    createdAt?: Date | string
    websites?: WebsiteCreateNestedManyWithoutOrganisationInput
    purposes?: PurposeCreateNestedManyWithoutOrganisationInput
    policies?: PolicyCreateNestedManyWithoutOrganisationInput
    notices?: NoticeCreateNestedManyWithoutOrganisationInput
  }

  export type OrganisationUncheckedCreateInput = {
    id?: string
    name: string
    slug: string
    secretKeyHash: string
    createdAt?: Date | string
    websites?: WebsiteUncheckedCreateNestedManyWithoutOrganisationInput
    purposes?: PurposeUncheckedCreateNestedManyWithoutOrganisationInput
    policies?: PolicyUncheckedCreateNestedManyWithoutOrganisationInput
    notices?: NoticeUncheckedCreateNestedManyWithoutOrganisationInput
  }

  export type OrganisationUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    secretKeyHash?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    websites?: WebsiteUpdateManyWithoutOrganisationNestedInput
    purposes?: PurposeUpdateManyWithoutOrganisationNestedInput
    policies?: PolicyUpdateManyWithoutOrganisationNestedInput
    notices?: NoticeUpdateManyWithoutOrganisationNestedInput
  }

  export type OrganisationUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    secretKeyHash?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    websites?: WebsiteUncheckedUpdateManyWithoutOrganisationNestedInput
    purposes?: PurposeUncheckedUpdateManyWithoutOrganisationNestedInput
    policies?: PolicyUncheckedUpdateManyWithoutOrganisationNestedInput
    notices?: NoticeUncheckedUpdateManyWithoutOrganisationNestedInput
  }

  export type OrganisationCreateManyInput = {
    id?: string
    name: string
    slug: string
    secretKeyHash: string
    createdAt?: Date | string
  }

  export type OrganisationUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    secretKeyHash?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type OrganisationUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    secretKeyHash?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type WebsiteCreateInput = {
    id?: string
    name: string
    domain: string
    publicKey: string
    isActive?: boolean
    createdAt?: Date | string
    organisation: OrganisationCreateNestedOneWithoutWebsitesInput
    sessions?: SessionCreateNestedManyWithoutWebsiteInput
    events?: EventCreateNestedManyWithoutWebsiteInput
    principals?: PrincipalCreateNestedManyWithoutWebsiteInput
    consentRecords?: ConsentRecordCreateNestedManyWithoutWebsiteInput
  }

  export type WebsiteUncheckedCreateInput = {
    id?: string
    organisationId: string
    name: string
    domain: string
    publicKey: string
    isActive?: boolean
    createdAt?: Date | string
    sessions?: SessionUncheckedCreateNestedManyWithoutWebsiteInput
    events?: EventUncheckedCreateNestedManyWithoutWebsiteInput
    principals?: PrincipalUncheckedCreateNestedManyWithoutWebsiteInput
    consentRecords?: ConsentRecordUncheckedCreateNestedManyWithoutWebsiteInput
  }

  export type WebsiteUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    domain?: StringFieldUpdateOperationsInput | string
    publicKey?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    organisation?: OrganisationUpdateOneRequiredWithoutWebsitesNestedInput
    sessions?: SessionUpdateManyWithoutWebsiteNestedInput
    events?: EventUpdateManyWithoutWebsiteNestedInput
    principals?: PrincipalUpdateManyWithoutWebsiteNestedInput
    consentRecords?: ConsentRecordUpdateManyWithoutWebsiteNestedInput
  }

  export type WebsiteUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    organisationId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    domain?: StringFieldUpdateOperationsInput | string
    publicKey?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sessions?: SessionUncheckedUpdateManyWithoutWebsiteNestedInput
    events?: EventUncheckedUpdateManyWithoutWebsiteNestedInput
    principals?: PrincipalUncheckedUpdateManyWithoutWebsiteNestedInput
    consentRecords?: ConsentRecordUncheckedUpdateManyWithoutWebsiteNestedInput
  }

  export type WebsiteCreateManyInput = {
    id?: string
    organisationId: string
    name: string
    domain: string
    publicKey: string
    isActive?: boolean
    createdAt?: Date | string
  }

  export type WebsiteUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    domain?: StringFieldUpdateOperationsInput | string
    publicKey?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type WebsiteUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    organisationId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    domain?: StringFieldUpdateOperationsInput | string
    publicKey?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SessionCreateInput = {
    id?: string
    startedAt?: Date | string
    lastActivity: Date | string
    website: WebsiteCreateNestedOneWithoutSessionsInput
    events?: EventCreateNestedManyWithoutSessionInput
  }

  export type SessionUncheckedCreateInput = {
    id?: string
    siteId: string
    startedAt?: Date | string
    lastActivity: Date | string
    events?: EventUncheckedCreateNestedManyWithoutSessionInput
  }

  export type SessionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    lastActivity?: DateTimeFieldUpdateOperationsInput | Date | string
    website?: WebsiteUpdateOneRequiredWithoutSessionsNestedInput
    events?: EventUpdateManyWithoutSessionNestedInput
  }

  export type SessionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    siteId?: StringFieldUpdateOperationsInput | string
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    lastActivity?: DateTimeFieldUpdateOperationsInput | Date | string
    events?: EventUncheckedUpdateManyWithoutSessionNestedInput
  }

  export type SessionCreateManyInput = {
    id?: string
    siteId: string
    startedAt?: Date | string
    lastActivity: Date | string
  }

  export type SessionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    lastActivity?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SessionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    siteId?: StringFieldUpdateOperationsInput | string
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    lastActivity?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EventCreateInput = {
    id?: string
    eventId: string
    eventType: string
    name?: string | null
    eventTime: Date | string
    pageUrl: string
    pageTitle: string
    referrer?: string | null
    deviceType: string
    browser: string
    os: string
    properties?: NullableJsonNullValueInput | InputJsonValue
    receivedAt?: Date | string
    website: WebsiteCreateNestedOneWithoutEventsInput
    session: SessionCreateNestedOneWithoutEventsInput
  }

  export type EventUncheckedCreateInput = {
    id?: string
    eventId: string
    siteId: string
    sessionId: string
    eventType: string
    name?: string | null
    eventTime: Date | string
    pageUrl: string
    pageTitle: string
    referrer?: string | null
    deviceType: string
    browser: string
    os: string
    properties?: NullableJsonNullValueInput | InputJsonValue
    receivedAt?: Date | string
  }

  export type EventUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    eventId?: StringFieldUpdateOperationsInput | string
    eventType?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    eventTime?: DateTimeFieldUpdateOperationsInput | Date | string
    pageUrl?: StringFieldUpdateOperationsInput | string
    pageTitle?: StringFieldUpdateOperationsInput | string
    referrer?: NullableStringFieldUpdateOperationsInput | string | null
    deviceType?: StringFieldUpdateOperationsInput | string
    browser?: StringFieldUpdateOperationsInput | string
    os?: StringFieldUpdateOperationsInput | string
    properties?: NullableJsonNullValueInput | InputJsonValue
    receivedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    website?: WebsiteUpdateOneRequiredWithoutEventsNestedInput
    session?: SessionUpdateOneRequiredWithoutEventsNestedInput
  }

  export type EventUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    eventId?: StringFieldUpdateOperationsInput | string
    siteId?: StringFieldUpdateOperationsInput | string
    sessionId?: StringFieldUpdateOperationsInput | string
    eventType?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    eventTime?: DateTimeFieldUpdateOperationsInput | Date | string
    pageUrl?: StringFieldUpdateOperationsInput | string
    pageTitle?: StringFieldUpdateOperationsInput | string
    referrer?: NullableStringFieldUpdateOperationsInput | string | null
    deviceType?: StringFieldUpdateOperationsInput | string
    browser?: StringFieldUpdateOperationsInput | string
    os?: StringFieldUpdateOperationsInput | string
    properties?: NullableJsonNullValueInput | InputJsonValue
    receivedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EventCreateManyInput = {
    id?: string
    eventId: string
    siteId: string
    sessionId: string
    eventType: string
    name?: string | null
    eventTime: Date | string
    pageUrl: string
    pageTitle: string
    referrer?: string | null
    deviceType: string
    browser: string
    os: string
    properties?: NullableJsonNullValueInput | InputJsonValue
    receivedAt?: Date | string
  }

  export type EventUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    eventId?: StringFieldUpdateOperationsInput | string
    eventType?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    eventTime?: DateTimeFieldUpdateOperationsInput | Date | string
    pageUrl?: StringFieldUpdateOperationsInput | string
    pageTitle?: StringFieldUpdateOperationsInput | string
    referrer?: NullableStringFieldUpdateOperationsInput | string | null
    deviceType?: StringFieldUpdateOperationsInput | string
    browser?: StringFieldUpdateOperationsInput | string
    os?: StringFieldUpdateOperationsInput | string
    properties?: NullableJsonNullValueInput | InputJsonValue
    receivedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EventUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    eventId?: StringFieldUpdateOperationsInput | string
    siteId?: StringFieldUpdateOperationsInput | string
    sessionId?: StringFieldUpdateOperationsInput | string
    eventType?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    eventTime?: DateTimeFieldUpdateOperationsInput | Date | string
    pageUrl?: StringFieldUpdateOperationsInput | string
    pageTitle?: StringFieldUpdateOperationsInput | string
    referrer?: NullableStringFieldUpdateOperationsInput | string | null
    deviceType?: StringFieldUpdateOperationsInput | string
    browser?: StringFieldUpdateOperationsInput | string
    os?: StringFieldUpdateOperationsInput | string
    properties?: NullableJsonNullValueInput | InputJsonValue
    receivedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PrincipalCreateInput = {
    id?: string
    externalId: string
    kind?: string
    createdAt?: Date | string
    website: WebsiteCreateNestedOneWithoutPrincipalsInput
    consentRecords?: ConsentRecordCreateNestedManyWithoutPrincipalInput
  }

  export type PrincipalUncheckedCreateInput = {
    id?: string
    siteId: string
    externalId: string
    kind?: string
    createdAt?: Date | string
    consentRecords?: ConsentRecordUncheckedCreateNestedManyWithoutPrincipalInput
  }

  export type PrincipalUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    externalId?: StringFieldUpdateOperationsInput | string
    kind?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    website?: WebsiteUpdateOneRequiredWithoutPrincipalsNestedInput
    consentRecords?: ConsentRecordUpdateManyWithoutPrincipalNestedInput
  }

  export type PrincipalUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    siteId?: StringFieldUpdateOperationsInput | string
    externalId?: StringFieldUpdateOperationsInput | string
    kind?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    consentRecords?: ConsentRecordUncheckedUpdateManyWithoutPrincipalNestedInput
  }

  export type PrincipalCreateManyInput = {
    id?: string
    siteId: string
    externalId: string
    kind?: string
    createdAt?: Date | string
  }

  export type PrincipalUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    externalId?: StringFieldUpdateOperationsInput | string
    kind?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PrincipalUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    siteId?: StringFieldUpdateOperationsInput | string
    externalId?: StringFieldUpdateOperationsInput | string
    kind?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PurposeCreateInput = {
    id?: string
    code: string
    name: string
    description: string
    isActive?: boolean
    createdAt?: Date | string
    organisation: OrganisationCreateNestedOneWithoutPurposesInput
    noticePurposes?: NoticePurposeCreateNestedManyWithoutPurposeInput
    consentRecords?: ConsentRecordCreateNestedManyWithoutPurposeInput
  }

  export type PurposeUncheckedCreateInput = {
    id?: string
    organisationId: string
    code: string
    name: string
    description: string
    isActive?: boolean
    createdAt?: Date | string
    noticePurposes?: NoticePurposeUncheckedCreateNestedManyWithoutPurposeInput
    consentRecords?: ConsentRecordUncheckedCreateNestedManyWithoutPurposeInput
  }

  export type PurposeUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    organisation?: OrganisationUpdateOneRequiredWithoutPurposesNestedInput
    noticePurposes?: NoticePurposeUpdateManyWithoutPurposeNestedInput
    consentRecords?: ConsentRecordUpdateManyWithoutPurposeNestedInput
  }

  export type PurposeUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    organisationId?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    noticePurposes?: NoticePurposeUncheckedUpdateManyWithoutPurposeNestedInput
    consentRecords?: ConsentRecordUncheckedUpdateManyWithoutPurposeNestedInput
  }

  export type PurposeCreateManyInput = {
    id?: string
    organisationId: string
    code: string
    name: string
    description: string
    isActive?: boolean
    createdAt?: Date | string
  }

  export type PurposeUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PurposeUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    organisationId?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PolicyCreateInput = {
    id?: string
    code: string
    name: string
    createdAt?: Date | string
    organisation: OrganisationCreateNestedOneWithoutPoliciesInput
    versions?: PolicyVersionCreateNestedManyWithoutPolicyInput
  }

  export type PolicyUncheckedCreateInput = {
    id?: string
    organisationId: string
    code: string
    name: string
    createdAt?: Date | string
    versions?: PolicyVersionUncheckedCreateNestedManyWithoutPolicyInput
  }

  export type PolicyUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    organisation?: OrganisationUpdateOneRequiredWithoutPoliciesNestedInput
    versions?: PolicyVersionUpdateManyWithoutPolicyNestedInput
  }

  export type PolicyUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    organisationId?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    versions?: PolicyVersionUncheckedUpdateManyWithoutPolicyNestedInput
  }

  export type PolicyCreateManyInput = {
    id?: string
    organisationId: string
    code: string
    name: string
    createdAt?: Date | string
  }

  export type PolicyUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PolicyUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    organisationId?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PolicyVersionCreateInput = {
    id?: string
    version: string
    documentUrl?: string | null
    contentHash?: string | null
    publishedAt?: Date | string
    policy: PolicyCreateNestedOneWithoutVersionsInput
    notices?: NoticeCreateNestedManyWithoutPolicyVersionInput
    consentRecords?: ConsentRecordCreateNestedManyWithoutPolicyVersionInput
  }

  export type PolicyVersionUncheckedCreateInput = {
    id?: string
    organisationId: string
    policyId: string
    version: string
    documentUrl?: string | null
    contentHash?: string | null
    publishedAt?: Date | string
    notices?: NoticeUncheckedCreateNestedManyWithoutPolicyVersionInput
    consentRecords?: ConsentRecordUncheckedCreateNestedManyWithoutPolicyVersionInput
  }

  export type PolicyVersionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    version?: StringFieldUpdateOperationsInput | string
    documentUrl?: NullableStringFieldUpdateOperationsInput | string | null
    contentHash?: NullableStringFieldUpdateOperationsInput | string | null
    publishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    policy?: PolicyUpdateOneRequiredWithoutVersionsNestedInput
    notices?: NoticeUpdateManyWithoutPolicyVersionNestedInput
    consentRecords?: ConsentRecordUpdateManyWithoutPolicyVersionNestedInput
  }

  export type PolicyVersionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    organisationId?: StringFieldUpdateOperationsInput | string
    policyId?: StringFieldUpdateOperationsInput | string
    version?: StringFieldUpdateOperationsInput | string
    documentUrl?: NullableStringFieldUpdateOperationsInput | string | null
    contentHash?: NullableStringFieldUpdateOperationsInput | string | null
    publishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    notices?: NoticeUncheckedUpdateManyWithoutPolicyVersionNestedInput
    consentRecords?: ConsentRecordUncheckedUpdateManyWithoutPolicyVersionNestedInput
  }

  export type PolicyVersionCreateManyInput = {
    id?: string
    organisationId: string
    policyId: string
    version: string
    documentUrl?: string | null
    contentHash?: string | null
    publishedAt?: Date | string
  }

  export type PolicyVersionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    version?: StringFieldUpdateOperationsInput | string
    documentUrl?: NullableStringFieldUpdateOperationsInput | string | null
    contentHash?: NullableStringFieldUpdateOperationsInput | string | null
    publishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PolicyVersionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    organisationId?: StringFieldUpdateOperationsInput | string
    policyId?: StringFieldUpdateOperationsInput | string
    version?: StringFieldUpdateOperationsInput | string
    documentUrl?: NullableStringFieldUpdateOperationsInput | string | null
    contentHash?: NullableStringFieldUpdateOperationsInput | string | null
    publishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type NoticeCreateInput = {
    id?: string
    version: string
    locale?: string
    publishedAt?: Date | string
    organisation: OrganisationCreateNestedOneWithoutNoticesInput
    policyVersion: PolicyVersionCreateNestedOneWithoutNoticesInput
    purposes?: NoticePurposeCreateNestedManyWithoutNoticeInput
    consentRecords?: ConsentRecordCreateNestedManyWithoutNoticeInput
  }

  export type NoticeUncheckedCreateInput = {
    id?: string
    organisationId: string
    policyVersionId: string
    version: string
    locale?: string
    publishedAt?: Date | string
    purposes?: NoticePurposeUncheckedCreateNestedManyWithoutNoticeInput
    consentRecords?: ConsentRecordUncheckedCreateNestedManyWithoutNoticeInput
  }

  export type NoticeUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    version?: StringFieldUpdateOperationsInput | string
    locale?: StringFieldUpdateOperationsInput | string
    publishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    organisation?: OrganisationUpdateOneRequiredWithoutNoticesNestedInput
    policyVersion?: PolicyVersionUpdateOneRequiredWithoutNoticesNestedInput
    purposes?: NoticePurposeUpdateManyWithoutNoticeNestedInput
    consentRecords?: ConsentRecordUpdateManyWithoutNoticeNestedInput
  }

  export type NoticeUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    organisationId?: StringFieldUpdateOperationsInput | string
    policyVersionId?: StringFieldUpdateOperationsInput | string
    version?: StringFieldUpdateOperationsInput | string
    locale?: StringFieldUpdateOperationsInput | string
    publishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    purposes?: NoticePurposeUncheckedUpdateManyWithoutNoticeNestedInput
    consentRecords?: ConsentRecordUncheckedUpdateManyWithoutNoticeNestedInput
  }

  export type NoticeCreateManyInput = {
    id?: string
    organisationId: string
    policyVersionId: string
    version: string
    locale?: string
    publishedAt?: Date | string
  }

  export type NoticeUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    version?: StringFieldUpdateOperationsInput | string
    locale?: StringFieldUpdateOperationsInput | string
    publishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type NoticeUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    organisationId?: StringFieldUpdateOperationsInput | string
    policyVersionId?: StringFieldUpdateOperationsInput | string
    version?: StringFieldUpdateOperationsInput | string
    locale?: StringFieldUpdateOperationsInput | string
    publishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type NoticePurposeCreateInput = {
    notice: NoticeCreateNestedOneWithoutPurposesInput
    purpose: PurposeCreateNestedOneWithoutNoticePurposesInput
  }

  export type NoticePurposeUncheckedCreateInput = {
    noticeId: string
    purposeId: string
  }

  export type NoticePurposeUpdateInput = {
    notice?: NoticeUpdateOneRequiredWithoutPurposesNestedInput
    purpose?: PurposeUpdateOneRequiredWithoutNoticePurposesNestedInput
  }

  export type NoticePurposeUncheckedUpdateInput = {
    noticeId?: StringFieldUpdateOperationsInput | string
    purposeId?: StringFieldUpdateOperationsInput | string
  }

  export type NoticePurposeCreateManyInput = {
    noticeId: string
    purposeId: string
  }

  export type NoticePurposeUpdateManyMutationInput = {

  }

  export type NoticePurposeUncheckedUpdateManyInput = {
    noticeId?: StringFieldUpdateOperationsInput | string
    purposeId?: StringFieldUpdateOperationsInput | string
  }

  export type ConsentRecordCreateInput = {
    id?: string
    status: string
    source?: string
    decidedAt: Date | string
    recordedAt?: Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
    website: WebsiteCreateNestedOneWithoutConsentRecordsInput
    principal: PrincipalCreateNestedOneWithoutConsentRecordsInput
    purpose: PurposeCreateNestedOneWithoutConsentRecordsInput
    notice?: NoticeCreateNestedOneWithoutConsentRecordsInput
    policyVersion?: PolicyVersionCreateNestedOneWithoutConsentRecordsInput
  }

  export type ConsentRecordUncheckedCreateInput = {
    id?: string
    organisationId: string
    siteId: string
    principalId: string
    purposeId: string
    noticeId?: string | null
    policyVersionId?: string | null
    status: string
    source?: string
    decidedAt: Date | string
    recordedAt?: Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
  }

  export type ConsentRecordUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    source?: StringFieldUpdateOperationsInput | string
    decidedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    recordedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
    website?: WebsiteUpdateOneRequiredWithoutConsentRecordsNestedInput
    principal?: PrincipalUpdateOneRequiredWithoutConsentRecordsNestedInput
    purpose?: PurposeUpdateOneRequiredWithoutConsentRecordsNestedInput
    notice?: NoticeUpdateOneWithoutConsentRecordsNestedInput
    policyVersion?: PolicyVersionUpdateOneWithoutConsentRecordsNestedInput
  }

  export type ConsentRecordUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    organisationId?: StringFieldUpdateOperationsInput | string
    siteId?: StringFieldUpdateOperationsInput | string
    principalId?: StringFieldUpdateOperationsInput | string
    purposeId?: StringFieldUpdateOperationsInput | string
    noticeId?: NullableStringFieldUpdateOperationsInput | string | null
    policyVersionId?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    source?: StringFieldUpdateOperationsInput | string
    decidedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    recordedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
  }

  export type ConsentRecordCreateManyInput = {
    id?: string
    organisationId: string
    siteId: string
    principalId: string
    purposeId: string
    noticeId?: string | null
    policyVersionId?: string | null
    status: string
    source?: string
    decidedAt: Date | string
    recordedAt?: Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
  }

  export type ConsentRecordUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    source?: StringFieldUpdateOperationsInput | string
    decidedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    recordedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
  }

  export type ConsentRecordUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    organisationId?: StringFieldUpdateOperationsInput | string
    siteId?: StringFieldUpdateOperationsInput | string
    principalId?: StringFieldUpdateOperationsInput | string
    purposeId?: StringFieldUpdateOperationsInput | string
    noticeId?: NullableStringFieldUpdateOperationsInput | string | null
    policyVersionId?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    source?: StringFieldUpdateOperationsInput | string
    decidedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    recordedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type WebsiteListRelationFilter = {
    every?: WebsiteWhereInput
    some?: WebsiteWhereInput
    none?: WebsiteWhereInput
  }

  export type PurposeListRelationFilter = {
    every?: PurposeWhereInput
    some?: PurposeWhereInput
    none?: PurposeWhereInput
  }

  export type PolicyListRelationFilter = {
    every?: PolicyWhereInput
    some?: PolicyWhereInput
    none?: PolicyWhereInput
  }

  export type NoticeListRelationFilter = {
    every?: NoticeWhereInput
    some?: NoticeWhereInput
    none?: NoticeWhereInput
  }

  export type WebsiteOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type PurposeOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type PolicyOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type NoticeOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type OrganisationCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    slug?: SortOrder
    secretKeyHash?: SortOrder
    createdAt?: SortOrder
  }

  export type OrganisationMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    slug?: SortOrder
    secretKeyHash?: SortOrder
    createdAt?: SortOrder
  }

  export type OrganisationMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    slug?: SortOrder
    secretKeyHash?: SortOrder
    createdAt?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type OrganisationScalarRelationFilter = {
    is?: OrganisationWhereInput
    isNot?: OrganisationWhereInput
  }

  export type SessionListRelationFilter = {
    every?: SessionWhereInput
    some?: SessionWhereInput
    none?: SessionWhereInput
  }

  export type EventListRelationFilter = {
    every?: EventWhereInput
    some?: EventWhereInput
    none?: EventWhereInput
  }

  export type PrincipalListRelationFilter = {
    every?: PrincipalWhereInput
    some?: PrincipalWhereInput
    none?: PrincipalWhereInput
  }

  export type ConsentRecordListRelationFilter = {
    every?: ConsentRecordWhereInput
    some?: ConsentRecordWhereInput
    none?: ConsentRecordWhereInput
  }

  export type SessionOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type EventOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type PrincipalOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ConsentRecordOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type WebsiteIdOrganisationIdCompoundUniqueInput = {
    id: string
    organisationId: string
  }

  export type WebsiteCountOrderByAggregateInput = {
    id?: SortOrder
    organisationId?: SortOrder
    name?: SortOrder
    domain?: SortOrder
    publicKey?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
  }

  export type WebsiteMaxOrderByAggregateInput = {
    id?: SortOrder
    organisationId?: SortOrder
    name?: SortOrder
    domain?: SortOrder
    publicKey?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
  }

  export type WebsiteMinOrderByAggregateInput = {
    id?: SortOrder
    organisationId?: SortOrder
    name?: SortOrder
    domain?: SortOrder
    publicKey?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type WebsiteScalarRelationFilter = {
    is?: WebsiteWhereInput
    isNot?: WebsiteWhereInput
  }

  export type SessionIdSiteIdCompoundUniqueInput = {
    id: string
    siteId: string
  }

  export type SessionCountOrderByAggregateInput = {
    id?: SortOrder
    siteId?: SortOrder
    startedAt?: SortOrder
    lastActivity?: SortOrder
  }

  export type SessionMaxOrderByAggregateInput = {
    id?: SortOrder
    siteId?: SortOrder
    startedAt?: SortOrder
    lastActivity?: SortOrder
  }

  export type SessionMinOrderByAggregateInput = {
    id?: SortOrder
    siteId?: SortOrder
    startedAt?: SortOrder
    lastActivity?: SortOrder
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }
  export type JsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type SessionScalarRelationFilter = {
    is?: SessionWhereInput
    isNot?: SessionWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type EventCountOrderByAggregateInput = {
    id?: SortOrder
    eventId?: SortOrder
    siteId?: SortOrder
    sessionId?: SortOrder
    eventType?: SortOrder
    name?: SortOrder
    eventTime?: SortOrder
    pageUrl?: SortOrder
    pageTitle?: SortOrder
    referrer?: SortOrder
    deviceType?: SortOrder
    browser?: SortOrder
    os?: SortOrder
    properties?: SortOrder
    receivedAt?: SortOrder
  }

  export type EventMaxOrderByAggregateInput = {
    id?: SortOrder
    eventId?: SortOrder
    siteId?: SortOrder
    sessionId?: SortOrder
    eventType?: SortOrder
    name?: SortOrder
    eventTime?: SortOrder
    pageUrl?: SortOrder
    pageTitle?: SortOrder
    referrer?: SortOrder
    deviceType?: SortOrder
    browser?: SortOrder
    os?: SortOrder
    receivedAt?: SortOrder
  }

  export type EventMinOrderByAggregateInput = {
    id?: SortOrder
    eventId?: SortOrder
    siteId?: SortOrder
    sessionId?: SortOrder
    eventType?: SortOrder
    name?: SortOrder
    eventTime?: SortOrder
    pageUrl?: SortOrder
    pageTitle?: SortOrder
    referrer?: SortOrder
    deviceType?: SortOrder
    browser?: SortOrder
    os?: SortOrder
    receivedAt?: SortOrder
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }
  export type JsonNullableWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedJsonNullableFilter<$PrismaModel>
    _max?: NestedJsonNullableFilter<$PrismaModel>
  }

  export type PrincipalSiteIdExternalIdCompoundUniqueInput = {
    siteId: string
    externalId: string
  }

  export type PrincipalIdSiteIdCompoundUniqueInput = {
    id: string
    siteId: string
  }

  export type PrincipalCountOrderByAggregateInput = {
    id?: SortOrder
    siteId?: SortOrder
    externalId?: SortOrder
    kind?: SortOrder
    createdAt?: SortOrder
  }

  export type PrincipalMaxOrderByAggregateInput = {
    id?: SortOrder
    siteId?: SortOrder
    externalId?: SortOrder
    kind?: SortOrder
    createdAt?: SortOrder
  }

  export type PrincipalMinOrderByAggregateInput = {
    id?: SortOrder
    siteId?: SortOrder
    externalId?: SortOrder
    kind?: SortOrder
    createdAt?: SortOrder
  }

  export type NoticePurposeListRelationFilter = {
    every?: NoticePurposeWhereInput
    some?: NoticePurposeWhereInput
    none?: NoticePurposeWhereInput
  }

  export type NoticePurposeOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type PurposeOrganisationIdCodeCompoundUniqueInput = {
    organisationId: string
    code: string
  }

  export type PurposeIdOrganisationIdCompoundUniqueInput = {
    id: string
    organisationId: string
  }

  export type PurposeCountOrderByAggregateInput = {
    id?: SortOrder
    organisationId?: SortOrder
    code?: SortOrder
    name?: SortOrder
    description?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
  }

  export type PurposeMaxOrderByAggregateInput = {
    id?: SortOrder
    organisationId?: SortOrder
    code?: SortOrder
    name?: SortOrder
    description?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
  }

  export type PurposeMinOrderByAggregateInput = {
    id?: SortOrder
    organisationId?: SortOrder
    code?: SortOrder
    name?: SortOrder
    description?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
  }

  export type PolicyVersionListRelationFilter = {
    every?: PolicyVersionWhereInput
    some?: PolicyVersionWhereInput
    none?: PolicyVersionWhereInput
  }

  export type PolicyVersionOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type PolicyOrganisationIdCodeCompoundUniqueInput = {
    organisationId: string
    code: string
  }

  export type PolicyIdOrganisationIdCompoundUniqueInput = {
    id: string
    organisationId: string
  }

  export type PolicyCountOrderByAggregateInput = {
    id?: SortOrder
    organisationId?: SortOrder
    code?: SortOrder
    name?: SortOrder
    createdAt?: SortOrder
  }

  export type PolicyMaxOrderByAggregateInput = {
    id?: SortOrder
    organisationId?: SortOrder
    code?: SortOrder
    name?: SortOrder
    createdAt?: SortOrder
  }

  export type PolicyMinOrderByAggregateInput = {
    id?: SortOrder
    organisationId?: SortOrder
    code?: SortOrder
    name?: SortOrder
    createdAt?: SortOrder
  }

  export type PolicyScalarRelationFilter = {
    is?: PolicyWhereInput
    isNot?: PolicyWhereInput
  }

  export type PolicyVersionPolicyIdVersionCompoundUniqueInput = {
    policyId: string
    version: string
  }

  export type PolicyVersionIdOrganisationIdCompoundUniqueInput = {
    id: string
    organisationId: string
  }

  export type PolicyVersionCountOrderByAggregateInput = {
    id?: SortOrder
    organisationId?: SortOrder
    policyId?: SortOrder
    version?: SortOrder
    documentUrl?: SortOrder
    contentHash?: SortOrder
    publishedAt?: SortOrder
  }

  export type PolicyVersionMaxOrderByAggregateInput = {
    id?: SortOrder
    organisationId?: SortOrder
    policyId?: SortOrder
    version?: SortOrder
    documentUrl?: SortOrder
    contentHash?: SortOrder
    publishedAt?: SortOrder
  }

  export type PolicyVersionMinOrderByAggregateInput = {
    id?: SortOrder
    organisationId?: SortOrder
    policyId?: SortOrder
    version?: SortOrder
    documentUrl?: SortOrder
    contentHash?: SortOrder
    publishedAt?: SortOrder
  }

  export type PolicyVersionScalarRelationFilter = {
    is?: PolicyVersionWhereInput
    isNot?: PolicyVersionWhereInput
  }

  export type NoticeOrganisationIdVersionLocaleCompoundUniqueInput = {
    organisationId: string
    version: string
    locale: string
  }

  export type NoticeIdOrganisationIdCompoundUniqueInput = {
    id: string
    organisationId: string
  }

  export type NoticeCountOrderByAggregateInput = {
    id?: SortOrder
    organisationId?: SortOrder
    policyVersionId?: SortOrder
    version?: SortOrder
    locale?: SortOrder
    publishedAt?: SortOrder
  }

  export type NoticeMaxOrderByAggregateInput = {
    id?: SortOrder
    organisationId?: SortOrder
    policyVersionId?: SortOrder
    version?: SortOrder
    locale?: SortOrder
    publishedAt?: SortOrder
  }

  export type NoticeMinOrderByAggregateInput = {
    id?: SortOrder
    organisationId?: SortOrder
    policyVersionId?: SortOrder
    version?: SortOrder
    locale?: SortOrder
    publishedAt?: SortOrder
  }

  export type NoticeScalarRelationFilter = {
    is?: NoticeWhereInput
    isNot?: NoticeWhereInput
  }

  export type PurposeScalarRelationFilter = {
    is?: PurposeWhereInput
    isNot?: PurposeWhereInput
  }

  export type NoticePurposeNoticeIdPurposeIdCompoundUniqueInput = {
    noticeId: string
    purposeId: string
  }

  export type NoticePurposeCountOrderByAggregateInput = {
    noticeId?: SortOrder
    purposeId?: SortOrder
  }

  export type NoticePurposeMaxOrderByAggregateInput = {
    noticeId?: SortOrder
    purposeId?: SortOrder
  }

  export type NoticePurposeMinOrderByAggregateInput = {
    noticeId?: SortOrder
    purposeId?: SortOrder
  }

  export type PrincipalScalarRelationFilter = {
    is?: PrincipalWhereInput
    isNot?: PrincipalWhereInput
  }

  export type NoticeNullableScalarRelationFilter = {
    is?: NoticeWhereInput | null
    isNot?: NoticeWhereInput | null
  }

  export type PolicyVersionNullableScalarRelationFilter = {
    is?: PolicyVersionWhereInput | null
    isNot?: PolicyVersionWhereInput | null
  }

  export type ConsentRecordCountOrderByAggregateInput = {
    id?: SortOrder
    organisationId?: SortOrder
    siteId?: SortOrder
    principalId?: SortOrder
    purposeId?: SortOrder
    noticeId?: SortOrder
    policyVersionId?: SortOrder
    status?: SortOrder
    source?: SortOrder
    decidedAt?: SortOrder
    recordedAt?: SortOrder
    metadata?: SortOrder
  }

  export type ConsentRecordMaxOrderByAggregateInput = {
    id?: SortOrder
    organisationId?: SortOrder
    siteId?: SortOrder
    principalId?: SortOrder
    purposeId?: SortOrder
    noticeId?: SortOrder
    policyVersionId?: SortOrder
    status?: SortOrder
    source?: SortOrder
    decidedAt?: SortOrder
    recordedAt?: SortOrder
  }

  export type ConsentRecordMinOrderByAggregateInput = {
    id?: SortOrder
    organisationId?: SortOrder
    siteId?: SortOrder
    principalId?: SortOrder
    purposeId?: SortOrder
    noticeId?: SortOrder
    policyVersionId?: SortOrder
    status?: SortOrder
    source?: SortOrder
    decidedAt?: SortOrder
    recordedAt?: SortOrder
  }

  export type WebsiteCreateNestedManyWithoutOrganisationInput = {
    create?: XOR<WebsiteCreateWithoutOrganisationInput, WebsiteUncheckedCreateWithoutOrganisationInput> | WebsiteCreateWithoutOrganisationInput[] | WebsiteUncheckedCreateWithoutOrganisationInput[]
    connectOrCreate?: WebsiteCreateOrConnectWithoutOrganisationInput | WebsiteCreateOrConnectWithoutOrganisationInput[]
    createMany?: WebsiteCreateManyOrganisationInputEnvelope
    connect?: WebsiteWhereUniqueInput | WebsiteWhereUniqueInput[]
  }

  export type PurposeCreateNestedManyWithoutOrganisationInput = {
    create?: XOR<PurposeCreateWithoutOrganisationInput, PurposeUncheckedCreateWithoutOrganisationInput> | PurposeCreateWithoutOrganisationInput[] | PurposeUncheckedCreateWithoutOrganisationInput[]
    connectOrCreate?: PurposeCreateOrConnectWithoutOrganisationInput | PurposeCreateOrConnectWithoutOrganisationInput[]
    createMany?: PurposeCreateManyOrganisationInputEnvelope
    connect?: PurposeWhereUniqueInput | PurposeWhereUniqueInput[]
  }

  export type PolicyCreateNestedManyWithoutOrganisationInput = {
    create?: XOR<PolicyCreateWithoutOrganisationInput, PolicyUncheckedCreateWithoutOrganisationInput> | PolicyCreateWithoutOrganisationInput[] | PolicyUncheckedCreateWithoutOrganisationInput[]
    connectOrCreate?: PolicyCreateOrConnectWithoutOrganisationInput | PolicyCreateOrConnectWithoutOrganisationInput[]
    createMany?: PolicyCreateManyOrganisationInputEnvelope
    connect?: PolicyWhereUniqueInput | PolicyWhereUniqueInput[]
  }

  export type NoticeCreateNestedManyWithoutOrganisationInput = {
    create?: XOR<NoticeCreateWithoutOrganisationInput, NoticeUncheckedCreateWithoutOrganisationInput> | NoticeCreateWithoutOrganisationInput[] | NoticeUncheckedCreateWithoutOrganisationInput[]
    connectOrCreate?: NoticeCreateOrConnectWithoutOrganisationInput | NoticeCreateOrConnectWithoutOrganisationInput[]
    createMany?: NoticeCreateManyOrganisationInputEnvelope
    connect?: NoticeWhereUniqueInput | NoticeWhereUniqueInput[]
  }

  export type WebsiteUncheckedCreateNestedManyWithoutOrganisationInput = {
    create?: XOR<WebsiteCreateWithoutOrganisationInput, WebsiteUncheckedCreateWithoutOrganisationInput> | WebsiteCreateWithoutOrganisationInput[] | WebsiteUncheckedCreateWithoutOrganisationInput[]
    connectOrCreate?: WebsiteCreateOrConnectWithoutOrganisationInput | WebsiteCreateOrConnectWithoutOrganisationInput[]
    createMany?: WebsiteCreateManyOrganisationInputEnvelope
    connect?: WebsiteWhereUniqueInput | WebsiteWhereUniqueInput[]
  }

  export type PurposeUncheckedCreateNestedManyWithoutOrganisationInput = {
    create?: XOR<PurposeCreateWithoutOrganisationInput, PurposeUncheckedCreateWithoutOrganisationInput> | PurposeCreateWithoutOrganisationInput[] | PurposeUncheckedCreateWithoutOrganisationInput[]
    connectOrCreate?: PurposeCreateOrConnectWithoutOrganisationInput | PurposeCreateOrConnectWithoutOrganisationInput[]
    createMany?: PurposeCreateManyOrganisationInputEnvelope
    connect?: PurposeWhereUniqueInput | PurposeWhereUniqueInput[]
  }

  export type PolicyUncheckedCreateNestedManyWithoutOrganisationInput = {
    create?: XOR<PolicyCreateWithoutOrganisationInput, PolicyUncheckedCreateWithoutOrganisationInput> | PolicyCreateWithoutOrganisationInput[] | PolicyUncheckedCreateWithoutOrganisationInput[]
    connectOrCreate?: PolicyCreateOrConnectWithoutOrganisationInput | PolicyCreateOrConnectWithoutOrganisationInput[]
    createMany?: PolicyCreateManyOrganisationInputEnvelope
    connect?: PolicyWhereUniqueInput | PolicyWhereUniqueInput[]
  }

  export type NoticeUncheckedCreateNestedManyWithoutOrganisationInput = {
    create?: XOR<NoticeCreateWithoutOrganisationInput, NoticeUncheckedCreateWithoutOrganisationInput> | NoticeCreateWithoutOrganisationInput[] | NoticeUncheckedCreateWithoutOrganisationInput[]
    connectOrCreate?: NoticeCreateOrConnectWithoutOrganisationInput | NoticeCreateOrConnectWithoutOrganisationInput[]
    createMany?: NoticeCreateManyOrganisationInputEnvelope
    connect?: NoticeWhereUniqueInput | NoticeWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type WebsiteUpdateManyWithoutOrganisationNestedInput = {
    create?: XOR<WebsiteCreateWithoutOrganisationInput, WebsiteUncheckedCreateWithoutOrganisationInput> | WebsiteCreateWithoutOrganisationInput[] | WebsiteUncheckedCreateWithoutOrganisationInput[]
    connectOrCreate?: WebsiteCreateOrConnectWithoutOrganisationInput | WebsiteCreateOrConnectWithoutOrganisationInput[]
    upsert?: WebsiteUpsertWithWhereUniqueWithoutOrganisationInput | WebsiteUpsertWithWhereUniqueWithoutOrganisationInput[]
    createMany?: WebsiteCreateManyOrganisationInputEnvelope
    set?: WebsiteWhereUniqueInput | WebsiteWhereUniqueInput[]
    disconnect?: WebsiteWhereUniqueInput | WebsiteWhereUniqueInput[]
    delete?: WebsiteWhereUniqueInput | WebsiteWhereUniqueInput[]
    connect?: WebsiteWhereUniqueInput | WebsiteWhereUniqueInput[]
    update?: WebsiteUpdateWithWhereUniqueWithoutOrganisationInput | WebsiteUpdateWithWhereUniqueWithoutOrganisationInput[]
    updateMany?: WebsiteUpdateManyWithWhereWithoutOrganisationInput | WebsiteUpdateManyWithWhereWithoutOrganisationInput[]
    deleteMany?: WebsiteScalarWhereInput | WebsiteScalarWhereInput[]
  }

  export type PurposeUpdateManyWithoutOrganisationNestedInput = {
    create?: XOR<PurposeCreateWithoutOrganisationInput, PurposeUncheckedCreateWithoutOrganisationInput> | PurposeCreateWithoutOrganisationInput[] | PurposeUncheckedCreateWithoutOrganisationInput[]
    connectOrCreate?: PurposeCreateOrConnectWithoutOrganisationInput | PurposeCreateOrConnectWithoutOrganisationInput[]
    upsert?: PurposeUpsertWithWhereUniqueWithoutOrganisationInput | PurposeUpsertWithWhereUniqueWithoutOrganisationInput[]
    createMany?: PurposeCreateManyOrganisationInputEnvelope
    set?: PurposeWhereUniqueInput | PurposeWhereUniqueInput[]
    disconnect?: PurposeWhereUniqueInput | PurposeWhereUniqueInput[]
    delete?: PurposeWhereUniqueInput | PurposeWhereUniqueInput[]
    connect?: PurposeWhereUniqueInput | PurposeWhereUniqueInput[]
    update?: PurposeUpdateWithWhereUniqueWithoutOrganisationInput | PurposeUpdateWithWhereUniqueWithoutOrganisationInput[]
    updateMany?: PurposeUpdateManyWithWhereWithoutOrganisationInput | PurposeUpdateManyWithWhereWithoutOrganisationInput[]
    deleteMany?: PurposeScalarWhereInput | PurposeScalarWhereInput[]
  }

  export type PolicyUpdateManyWithoutOrganisationNestedInput = {
    create?: XOR<PolicyCreateWithoutOrganisationInput, PolicyUncheckedCreateWithoutOrganisationInput> | PolicyCreateWithoutOrganisationInput[] | PolicyUncheckedCreateWithoutOrganisationInput[]
    connectOrCreate?: PolicyCreateOrConnectWithoutOrganisationInput | PolicyCreateOrConnectWithoutOrganisationInput[]
    upsert?: PolicyUpsertWithWhereUniqueWithoutOrganisationInput | PolicyUpsertWithWhereUniqueWithoutOrganisationInput[]
    createMany?: PolicyCreateManyOrganisationInputEnvelope
    set?: PolicyWhereUniqueInput | PolicyWhereUniqueInput[]
    disconnect?: PolicyWhereUniqueInput | PolicyWhereUniqueInput[]
    delete?: PolicyWhereUniqueInput | PolicyWhereUniqueInput[]
    connect?: PolicyWhereUniqueInput | PolicyWhereUniqueInput[]
    update?: PolicyUpdateWithWhereUniqueWithoutOrganisationInput | PolicyUpdateWithWhereUniqueWithoutOrganisationInput[]
    updateMany?: PolicyUpdateManyWithWhereWithoutOrganisationInput | PolicyUpdateManyWithWhereWithoutOrganisationInput[]
    deleteMany?: PolicyScalarWhereInput | PolicyScalarWhereInput[]
  }

  export type NoticeUpdateManyWithoutOrganisationNestedInput = {
    create?: XOR<NoticeCreateWithoutOrganisationInput, NoticeUncheckedCreateWithoutOrganisationInput> | NoticeCreateWithoutOrganisationInput[] | NoticeUncheckedCreateWithoutOrganisationInput[]
    connectOrCreate?: NoticeCreateOrConnectWithoutOrganisationInput | NoticeCreateOrConnectWithoutOrganisationInput[]
    upsert?: NoticeUpsertWithWhereUniqueWithoutOrganisationInput | NoticeUpsertWithWhereUniqueWithoutOrganisationInput[]
    createMany?: NoticeCreateManyOrganisationInputEnvelope
    set?: NoticeWhereUniqueInput | NoticeWhereUniqueInput[]
    disconnect?: NoticeWhereUniqueInput | NoticeWhereUniqueInput[]
    delete?: NoticeWhereUniqueInput | NoticeWhereUniqueInput[]
    connect?: NoticeWhereUniqueInput | NoticeWhereUniqueInput[]
    update?: NoticeUpdateWithWhereUniqueWithoutOrganisationInput | NoticeUpdateWithWhereUniqueWithoutOrganisationInput[]
    updateMany?: NoticeUpdateManyWithWhereWithoutOrganisationInput | NoticeUpdateManyWithWhereWithoutOrganisationInput[]
    deleteMany?: NoticeScalarWhereInput | NoticeScalarWhereInput[]
  }

  export type WebsiteUncheckedUpdateManyWithoutOrganisationNestedInput = {
    create?: XOR<WebsiteCreateWithoutOrganisationInput, WebsiteUncheckedCreateWithoutOrganisationInput> | WebsiteCreateWithoutOrganisationInput[] | WebsiteUncheckedCreateWithoutOrganisationInput[]
    connectOrCreate?: WebsiteCreateOrConnectWithoutOrganisationInput | WebsiteCreateOrConnectWithoutOrganisationInput[]
    upsert?: WebsiteUpsertWithWhereUniqueWithoutOrganisationInput | WebsiteUpsertWithWhereUniqueWithoutOrganisationInput[]
    createMany?: WebsiteCreateManyOrganisationInputEnvelope
    set?: WebsiteWhereUniqueInput | WebsiteWhereUniqueInput[]
    disconnect?: WebsiteWhereUniqueInput | WebsiteWhereUniqueInput[]
    delete?: WebsiteWhereUniqueInput | WebsiteWhereUniqueInput[]
    connect?: WebsiteWhereUniqueInput | WebsiteWhereUniqueInput[]
    update?: WebsiteUpdateWithWhereUniqueWithoutOrganisationInput | WebsiteUpdateWithWhereUniqueWithoutOrganisationInput[]
    updateMany?: WebsiteUpdateManyWithWhereWithoutOrganisationInput | WebsiteUpdateManyWithWhereWithoutOrganisationInput[]
    deleteMany?: WebsiteScalarWhereInput | WebsiteScalarWhereInput[]
  }

  export type PurposeUncheckedUpdateManyWithoutOrganisationNestedInput = {
    create?: XOR<PurposeCreateWithoutOrganisationInput, PurposeUncheckedCreateWithoutOrganisationInput> | PurposeCreateWithoutOrganisationInput[] | PurposeUncheckedCreateWithoutOrganisationInput[]
    connectOrCreate?: PurposeCreateOrConnectWithoutOrganisationInput | PurposeCreateOrConnectWithoutOrganisationInput[]
    upsert?: PurposeUpsertWithWhereUniqueWithoutOrganisationInput | PurposeUpsertWithWhereUniqueWithoutOrganisationInput[]
    createMany?: PurposeCreateManyOrganisationInputEnvelope
    set?: PurposeWhereUniqueInput | PurposeWhereUniqueInput[]
    disconnect?: PurposeWhereUniqueInput | PurposeWhereUniqueInput[]
    delete?: PurposeWhereUniqueInput | PurposeWhereUniqueInput[]
    connect?: PurposeWhereUniqueInput | PurposeWhereUniqueInput[]
    update?: PurposeUpdateWithWhereUniqueWithoutOrganisationInput | PurposeUpdateWithWhereUniqueWithoutOrganisationInput[]
    updateMany?: PurposeUpdateManyWithWhereWithoutOrganisationInput | PurposeUpdateManyWithWhereWithoutOrganisationInput[]
    deleteMany?: PurposeScalarWhereInput | PurposeScalarWhereInput[]
  }

  export type PolicyUncheckedUpdateManyWithoutOrganisationNestedInput = {
    create?: XOR<PolicyCreateWithoutOrganisationInput, PolicyUncheckedCreateWithoutOrganisationInput> | PolicyCreateWithoutOrganisationInput[] | PolicyUncheckedCreateWithoutOrganisationInput[]
    connectOrCreate?: PolicyCreateOrConnectWithoutOrganisationInput | PolicyCreateOrConnectWithoutOrganisationInput[]
    upsert?: PolicyUpsertWithWhereUniqueWithoutOrganisationInput | PolicyUpsertWithWhereUniqueWithoutOrganisationInput[]
    createMany?: PolicyCreateManyOrganisationInputEnvelope
    set?: PolicyWhereUniqueInput | PolicyWhereUniqueInput[]
    disconnect?: PolicyWhereUniqueInput | PolicyWhereUniqueInput[]
    delete?: PolicyWhereUniqueInput | PolicyWhereUniqueInput[]
    connect?: PolicyWhereUniqueInput | PolicyWhereUniqueInput[]
    update?: PolicyUpdateWithWhereUniqueWithoutOrganisationInput | PolicyUpdateWithWhereUniqueWithoutOrganisationInput[]
    updateMany?: PolicyUpdateManyWithWhereWithoutOrganisationInput | PolicyUpdateManyWithWhereWithoutOrganisationInput[]
    deleteMany?: PolicyScalarWhereInput | PolicyScalarWhereInput[]
  }

  export type NoticeUncheckedUpdateManyWithoutOrganisationNestedInput = {
    create?: XOR<NoticeCreateWithoutOrganisationInput, NoticeUncheckedCreateWithoutOrganisationInput> | NoticeCreateWithoutOrganisationInput[] | NoticeUncheckedCreateWithoutOrganisationInput[]
    connectOrCreate?: NoticeCreateOrConnectWithoutOrganisationInput | NoticeCreateOrConnectWithoutOrganisationInput[]
    upsert?: NoticeUpsertWithWhereUniqueWithoutOrganisationInput | NoticeUpsertWithWhereUniqueWithoutOrganisationInput[]
    createMany?: NoticeCreateManyOrganisationInputEnvelope
    set?: NoticeWhereUniqueInput | NoticeWhereUniqueInput[]
    disconnect?: NoticeWhereUniqueInput | NoticeWhereUniqueInput[]
    delete?: NoticeWhereUniqueInput | NoticeWhereUniqueInput[]
    connect?: NoticeWhereUniqueInput | NoticeWhereUniqueInput[]
    update?: NoticeUpdateWithWhereUniqueWithoutOrganisationInput | NoticeUpdateWithWhereUniqueWithoutOrganisationInput[]
    updateMany?: NoticeUpdateManyWithWhereWithoutOrganisationInput | NoticeUpdateManyWithWhereWithoutOrganisationInput[]
    deleteMany?: NoticeScalarWhereInput | NoticeScalarWhereInput[]
  }

  export type OrganisationCreateNestedOneWithoutWebsitesInput = {
    create?: XOR<OrganisationCreateWithoutWebsitesInput, OrganisationUncheckedCreateWithoutWebsitesInput>
    connectOrCreate?: OrganisationCreateOrConnectWithoutWebsitesInput
    connect?: OrganisationWhereUniqueInput
  }

  export type SessionCreateNestedManyWithoutWebsiteInput = {
    create?: XOR<SessionCreateWithoutWebsiteInput, SessionUncheckedCreateWithoutWebsiteInput> | SessionCreateWithoutWebsiteInput[] | SessionUncheckedCreateWithoutWebsiteInput[]
    connectOrCreate?: SessionCreateOrConnectWithoutWebsiteInput | SessionCreateOrConnectWithoutWebsiteInput[]
    createMany?: SessionCreateManyWebsiteInputEnvelope
    connect?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
  }

  export type EventCreateNestedManyWithoutWebsiteInput = {
    create?: XOR<EventCreateWithoutWebsiteInput, EventUncheckedCreateWithoutWebsiteInput> | EventCreateWithoutWebsiteInput[] | EventUncheckedCreateWithoutWebsiteInput[]
    connectOrCreate?: EventCreateOrConnectWithoutWebsiteInput | EventCreateOrConnectWithoutWebsiteInput[]
    createMany?: EventCreateManyWebsiteInputEnvelope
    connect?: EventWhereUniqueInput | EventWhereUniqueInput[]
  }

  export type PrincipalCreateNestedManyWithoutWebsiteInput = {
    create?: XOR<PrincipalCreateWithoutWebsiteInput, PrincipalUncheckedCreateWithoutWebsiteInput> | PrincipalCreateWithoutWebsiteInput[] | PrincipalUncheckedCreateWithoutWebsiteInput[]
    connectOrCreate?: PrincipalCreateOrConnectWithoutWebsiteInput | PrincipalCreateOrConnectWithoutWebsiteInput[]
    createMany?: PrincipalCreateManyWebsiteInputEnvelope
    connect?: PrincipalWhereUniqueInput | PrincipalWhereUniqueInput[]
  }

  export type ConsentRecordCreateNestedManyWithoutWebsiteInput = {
    create?: XOR<ConsentRecordCreateWithoutWebsiteInput, ConsentRecordUncheckedCreateWithoutWebsiteInput> | ConsentRecordCreateWithoutWebsiteInput[] | ConsentRecordUncheckedCreateWithoutWebsiteInput[]
    connectOrCreate?: ConsentRecordCreateOrConnectWithoutWebsiteInput | ConsentRecordCreateOrConnectWithoutWebsiteInput[]
    createMany?: ConsentRecordCreateManyWebsiteInputEnvelope
    connect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
  }

  export type SessionUncheckedCreateNestedManyWithoutWebsiteInput = {
    create?: XOR<SessionCreateWithoutWebsiteInput, SessionUncheckedCreateWithoutWebsiteInput> | SessionCreateWithoutWebsiteInput[] | SessionUncheckedCreateWithoutWebsiteInput[]
    connectOrCreate?: SessionCreateOrConnectWithoutWebsiteInput | SessionCreateOrConnectWithoutWebsiteInput[]
    createMany?: SessionCreateManyWebsiteInputEnvelope
    connect?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
  }

  export type EventUncheckedCreateNestedManyWithoutWebsiteInput = {
    create?: XOR<EventCreateWithoutWebsiteInput, EventUncheckedCreateWithoutWebsiteInput> | EventCreateWithoutWebsiteInput[] | EventUncheckedCreateWithoutWebsiteInput[]
    connectOrCreate?: EventCreateOrConnectWithoutWebsiteInput | EventCreateOrConnectWithoutWebsiteInput[]
    createMany?: EventCreateManyWebsiteInputEnvelope
    connect?: EventWhereUniqueInput | EventWhereUniqueInput[]
  }

  export type PrincipalUncheckedCreateNestedManyWithoutWebsiteInput = {
    create?: XOR<PrincipalCreateWithoutWebsiteInput, PrincipalUncheckedCreateWithoutWebsiteInput> | PrincipalCreateWithoutWebsiteInput[] | PrincipalUncheckedCreateWithoutWebsiteInput[]
    connectOrCreate?: PrincipalCreateOrConnectWithoutWebsiteInput | PrincipalCreateOrConnectWithoutWebsiteInput[]
    createMany?: PrincipalCreateManyWebsiteInputEnvelope
    connect?: PrincipalWhereUniqueInput | PrincipalWhereUniqueInput[]
  }

  export type ConsentRecordUncheckedCreateNestedManyWithoutWebsiteInput = {
    create?: XOR<ConsentRecordCreateWithoutWebsiteInput, ConsentRecordUncheckedCreateWithoutWebsiteInput> | ConsentRecordCreateWithoutWebsiteInput[] | ConsentRecordUncheckedCreateWithoutWebsiteInput[]
    connectOrCreate?: ConsentRecordCreateOrConnectWithoutWebsiteInput | ConsentRecordCreateOrConnectWithoutWebsiteInput[]
    createMany?: ConsentRecordCreateManyWebsiteInputEnvelope
    connect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type OrganisationUpdateOneRequiredWithoutWebsitesNestedInput = {
    create?: XOR<OrganisationCreateWithoutWebsitesInput, OrganisationUncheckedCreateWithoutWebsitesInput>
    connectOrCreate?: OrganisationCreateOrConnectWithoutWebsitesInput
    upsert?: OrganisationUpsertWithoutWebsitesInput
    connect?: OrganisationWhereUniqueInput
    update?: XOR<XOR<OrganisationUpdateToOneWithWhereWithoutWebsitesInput, OrganisationUpdateWithoutWebsitesInput>, OrganisationUncheckedUpdateWithoutWebsitesInput>
  }

  export type SessionUpdateManyWithoutWebsiteNestedInput = {
    create?: XOR<SessionCreateWithoutWebsiteInput, SessionUncheckedCreateWithoutWebsiteInput> | SessionCreateWithoutWebsiteInput[] | SessionUncheckedCreateWithoutWebsiteInput[]
    connectOrCreate?: SessionCreateOrConnectWithoutWebsiteInput | SessionCreateOrConnectWithoutWebsiteInput[]
    upsert?: SessionUpsertWithWhereUniqueWithoutWebsiteInput | SessionUpsertWithWhereUniqueWithoutWebsiteInput[]
    createMany?: SessionCreateManyWebsiteInputEnvelope
    set?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    disconnect?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    delete?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    connect?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    update?: SessionUpdateWithWhereUniqueWithoutWebsiteInput | SessionUpdateWithWhereUniqueWithoutWebsiteInput[]
    updateMany?: SessionUpdateManyWithWhereWithoutWebsiteInput | SessionUpdateManyWithWhereWithoutWebsiteInput[]
    deleteMany?: SessionScalarWhereInput | SessionScalarWhereInput[]
  }

  export type EventUpdateManyWithoutWebsiteNestedInput = {
    create?: XOR<EventCreateWithoutWebsiteInput, EventUncheckedCreateWithoutWebsiteInput> | EventCreateWithoutWebsiteInput[] | EventUncheckedCreateWithoutWebsiteInput[]
    connectOrCreate?: EventCreateOrConnectWithoutWebsiteInput | EventCreateOrConnectWithoutWebsiteInput[]
    upsert?: EventUpsertWithWhereUniqueWithoutWebsiteInput | EventUpsertWithWhereUniqueWithoutWebsiteInput[]
    createMany?: EventCreateManyWebsiteInputEnvelope
    set?: EventWhereUniqueInput | EventWhereUniqueInput[]
    disconnect?: EventWhereUniqueInput | EventWhereUniqueInput[]
    delete?: EventWhereUniqueInput | EventWhereUniqueInput[]
    connect?: EventWhereUniqueInput | EventWhereUniqueInput[]
    update?: EventUpdateWithWhereUniqueWithoutWebsiteInput | EventUpdateWithWhereUniqueWithoutWebsiteInput[]
    updateMany?: EventUpdateManyWithWhereWithoutWebsiteInput | EventUpdateManyWithWhereWithoutWebsiteInput[]
    deleteMany?: EventScalarWhereInput | EventScalarWhereInput[]
  }

  export type PrincipalUpdateManyWithoutWebsiteNestedInput = {
    create?: XOR<PrincipalCreateWithoutWebsiteInput, PrincipalUncheckedCreateWithoutWebsiteInput> | PrincipalCreateWithoutWebsiteInput[] | PrincipalUncheckedCreateWithoutWebsiteInput[]
    connectOrCreate?: PrincipalCreateOrConnectWithoutWebsiteInput | PrincipalCreateOrConnectWithoutWebsiteInput[]
    upsert?: PrincipalUpsertWithWhereUniqueWithoutWebsiteInput | PrincipalUpsertWithWhereUniqueWithoutWebsiteInput[]
    createMany?: PrincipalCreateManyWebsiteInputEnvelope
    set?: PrincipalWhereUniqueInput | PrincipalWhereUniqueInput[]
    disconnect?: PrincipalWhereUniqueInput | PrincipalWhereUniqueInput[]
    delete?: PrincipalWhereUniqueInput | PrincipalWhereUniqueInput[]
    connect?: PrincipalWhereUniqueInput | PrincipalWhereUniqueInput[]
    update?: PrincipalUpdateWithWhereUniqueWithoutWebsiteInput | PrincipalUpdateWithWhereUniqueWithoutWebsiteInput[]
    updateMany?: PrincipalUpdateManyWithWhereWithoutWebsiteInput | PrincipalUpdateManyWithWhereWithoutWebsiteInput[]
    deleteMany?: PrincipalScalarWhereInput | PrincipalScalarWhereInput[]
  }

  export type ConsentRecordUpdateManyWithoutWebsiteNestedInput = {
    create?: XOR<ConsentRecordCreateWithoutWebsiteInput, ConsentRecordUncheckedCreateWithoutWebsiteInput> | ConsentRecordCreateWithoutWebsiteInput[] | ConsentRecordUncheckedCreateWithoutWebsiteInput[]
    connectOrCreate?: ConsentRecordCreateOrConnectWithoutWebsiteInput | ConsentRecordCreateOrConnectWithoutWebsiteInput[]
    upsert?: ConsentRecordUpsertWithWhereUniqueWithoutWebsiteInput | ConsentRecordUpsertWithWhereUniqueWithoutWebsiteInput[]
    createMany?: ConsentRecordCreateManyWebsiteInputEnvelope
    set?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    disconnect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    delete?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    connect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    update?: ConsentRecordUpdateWithWhereUniqueWithoutWebsiteInput | ConsentRecordUpdateWithWhereUniqueWithoutWebsiteInput[]
    updateMany?: ConsentRecordUpdateManyWithWhereWithoutWebsiteInput | ConsentRecordUpdateManyWithWhereWithoutWebsiteInput[]
    deleteMany?: ConsentRecordScalarWhereInput | ConsentRecordScalarWhereInput[]
  }

  export type SessionUncheckedUpdateManyWithoutWebsiteNestedInput = {
    create?: XOR<SessionCreateWithoutWebsiteInput, SessionUncheckedCreateWithoutWebsiteInput> | SessionCreateWithoutWebsiteInput[] | SessionUncheckedCreateWithoutWebsiteInput[]
    connectOrCreate?: SessionCreateOrConnectWithoutWebsiteInput | SessionCreateOrConnectWithoutWebsiteInput[]
    upsert?: SessionUpsertWithWhereUniqueWithoutWebsiteInput | SessionUpsertWithWhereUniqueWithoutWebsiteInput[]
    createMany?: SessionCreateManyWebsiteInputEnvelope
    set?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    disconnect?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    delete?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    connect?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    update?: SessionUpdateWithWhereUniqueWithoutWebsiteInput | SessionUpdateWithWhereUniqueWithoutWebsiteInput[]
    updateMany?: SessionUpdateManyWithWhereWithoutWebsiteInput | SessionUpdateManyWithWhereWithoutWebsiteInput[]
    deleteMany?: SessionScalarWhereInput | SessionScalarWhereInput[]
  }

  export type EventUncheckedUpdateManyWithoutWebsiteNestedInput = {
    create?: XOR<EventCreateWithoutWebsiteInput, EventUncheckedCreateWithoutWebsiteInput> | EventCreateWithoutWebsiteInput[] | EventUncheckedCreateWithoutWebsiteInput[]
    connectOrCreate?: EventCreateOrConnectWithoutWebsiteInput | EventCreateOrConnectWithoutWebsiteInput[]
    upsert?: EventUpsertWithWhereUniqueWithoutWebsiteInput | EventUpsertWithWhereUniqueWithoutWebsiteInput[]
    createMany?: EventCreateManyWebsiteInputEnvelope
    set?: EventWhereUniqueInput | EventWhereUniqueInput[]
    disconnect?: EventWhereUniqueInput | EventWhereUniqueInput[]
    delete?: EventWhereUniqueInput | EventWhereUniqueInput[]
    connect?: EventWhereUniqueInput | EventWhereUniqueInput[]
    update?: EventUpdateWithWhereUniqueWithoutWebsiteInput | EventUpdateWithWhereUniqueWithoutWebsiteInput[]
    updateMany?: EventUpdateManyWithWhereWithoutWebsiteInput | EventUpdateManyWithWhereWithoutWebsiteInput[]
    deleteMany?: EventScalarWhereInput | EventScalarWhereInput[]
  }

  export type PrincipalUncheckedUpdateManyWithoutWebsiteNestedInput = {
    create?: XOR<PrincipalCreateWithoutWebsiteInput, PrincipalUncheckedCreateWithoutWebsiteInput> | PrincipalCreateWithoutWebsiteInput[] | PrincipalUncheckedCreateWithoutWebsiteInput[]
    connectOrCreate?: PrincipalCreateOrConnectWithoutWebsiteInput | PrincipalCreateOrConnectWithoutWebsiteInput[]
    upsert?: PrincipalUpsertWithWhereUniqueWithoutWebsiteInput | PrincipalUpsertWithWhereUniqueWithoutWebsiteInput[]
    createMany?: PrincipalCreateManyWebsiteInputEnvelope
    set?: PrincipalWhereUniqueInput | PrincipalWhereUniqueInput[]
    disconnect?: PrincipalWhereUniqueInput | PrincipalWhereUniqueInput[]
    delete?: PrincipalWhereUniqueInput | PrincipalWhereUniqueInput[]
    connect?: PrincipalWhereUniqueInput | PrincipalWhereUniqueInput[]
    update?: PrincipalUpdateWithWhereUniqueWithoutWebsiteInput | PrincipalUpdateWithWhereUniqueWithoutWebsiteInput[]
    updateMany?: PrincipalUpdateManyWithWhereWithoutWebsiteInput | PrincipalUpdateManyWithWhereWithoutWebsiteInput[]
    deleteMany?: PrincipalScalarWhereInput | PrincipalScalarWhereInput[]
  }

  export type ConsentRecordUncheckedUpdateManyWithoutWebsiteNestedInput = {
    create?: XOR<ConsentRecordCreateWithoutWebsiteInput, ConsentRecordUncheckedCreateWithoutWebsiteInput> | ConsentRecordCreateWithoutWebsiteInput[] | ConsentRecordUncheckedCreateWithoutWebsiteInput[]
    connectOrCreate?: ConsentRecordCreateOrConnectWithoutWebsiteInput | ConsentRecordCreateOrConnectWithoutWebsiteInput[]
    upsert?: ConsentRecordUpsertWithWhereUniqueWithoutWebsiteInput | ConsentRecordUpsertWithWhereUniqueWithoutWebsiteInput[]
    createMany?: ConsentRecordCreateManyWebsiteInputEnvelope
    set?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    disconnect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    delete?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    connect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    update?: ConsentRecordUpdateWithWhereUniqueWithoutWebsiteInput | ConsentRecordUpdateWithWhereUniqueWithoutWebsiteInput[]
    updateMany?: ConsentRecordUpdateManyWithWhereWithoutWebsiteInput | ConsentRecordUpdateManyWithWhereWithoutWebsiteInput[]
    deleteMany?: ConsentRecordScalarWhereInput | ConsentRecordScalarWhereInput[]
  }

  export type WebsiteCreateNestedOneWithoutSessionsInput = {
    create?: XOR<WebsiteCreateWithoutSessionsInput, WebsiteUncheckedCreateWithoutSessionsInput>
    connectOrCreate?: WebsiteCreateOrConnectWithoutSessionsInput
    connect?: WebsiteWhereUniqueInput
  }

  export type EventCreateNestedManyWithoutSessionInput = {
    create?: XOR<EventCreateWithoutSessionInput, EventUncheckedCreateWithoutSessionInput> | EventCreateWithoutSessionInput[] | EventUncheckedCreateWithoutSessionInput[]
    connectOrCreate?: EventCreateOrConnectWithoutSessionInput | EventCreateOrConnectWithoutSessionInput[]
    createMany?: EventCreateManySessionInputEnvelope
    connect?: EventWhereUniqueInput | EventWhereUniqueInput[]
  }

  export type EventUncheckedCreateNestedManyWithoutSessionInput = {
    create?: XOR<EventCreateWithoutSessionInput, EventUncheckedCreateWithoutSessionInput> | EventCreateWithoutSessionInput[] | EventUncheckedCreateWithoutSessionInput[]
    connectOrCreate?: EventCreateOrConnectWithoutSessionInput | EventCreateOrConnectWithoutSessionInput[]
    createMany?: EventCreateManySessionInputEnvelope
    connect?: EventWhereUniqueInput | EventWhereUniqueInput[]
  }

  export type WebsiteUpdateOneRequiredWithoutSessionsNestedInput = {
    create?: XOR<WebsiteCreateWithoutSessionsInput, WebsiteUncheckedCreateWithoutSessionsInput>
    connectOrCreate?: WebsiteCreateOrConnectWithoutSessionsInput
    upsert?: WebsiteUpsertWithoutSessionsInput
    connect?: WebsiteWhereUniqueInput
    update?: XOR<XOR<WebsiteUpdateToOneWithWhereWithoutSessionsInput, WebsiteUpdateWithoutSessionsInput>, WebsiteUncheckedUpdateWithoutSessionsInput>
  }

  export type EventUpdateManyWithoutSessionNestedInput = {
    create?: XOR<EventCreateWithoutSessionInput, EventUncheckedCreateWithoutSessionInput> | EventCreateWithoutSessionInput[] | EventUncheckedCreateWithoutSessionInput[]
    connectOrCreate?: EventCreateOrConnectWithoutSessionInput | EventCreateOrConnectWithoutSessionInput[]
    upsert?: EventUpsertWithWhereUniqueWithoutSessionInput | EventUpsertWithWhereUniqueWithoutSessionInput[]
    createMany?: EventCreateManySessionInputEnvelope
    set?: EventWhereUniqueInput | EventWhereUniqueInput[]
    disconnect?: EventWhereUniqueInput | EventWhereUniqueInput[]
    delete?: EventWhereUniqueInput | EventWhereUniqueInput[]
    connect?: EventWhereUniqueInput | EventWhereUniqueInput[]
    update?: EventUpdateWithWhereUniqueWithoutSessionInput | EventUpdateWithWhereUniqueWithoutSessionInput[]
    updateMany?: EventUpdateManyWithWhereWithoutSessionInput | EventUpdateManyWithWhereWithoutSessionInput[]
    deleteMany?: EventScalarWhereInput | EventScalarWhereInput[]
  }

  export type EventUncheckedUpdateManyWithoutSessionNestedInput = {
    create?: XOR<EventCreateWithoutSessionInput, EventUncheckedCreateWithoutSessionInput> | EventCreateWithoutSessionInput[] | EventUncheckedCreateWithoutSessionInput[]
    connectOrCreate?: EventCreateOrConnectWithoutSessionInput | EventCreateOrConnectWithoutSessionInput[]
    upsert?: EventUpsertWithWhereUniqueWithoutSessionInput | EventUpsertWithWhereUniqueWithoutSessionInput[]
    createMany?: EventCreateManySessionInputEnvelope
    set?: EventWhereUniqueInput | EventWhereUniqueInput[]
    disconnect?: EventWhereUniqueInput | EventWhereUniqueInput[]
    delete?: EventWhereUniqueInput | EventWhereUniqueInput[]
    connect?: EventWhereUniqueInput | EventWhereUniqueInput[]
    update?: EventUpdateWithWhereUniqueWithoutSessionInput | EventUpdateWithWhereUniqueWithoutSessionInput[]
    updateMany?: EventUpdateManyWithWhereWithoutSessionInput | EventUpdateManyWithWhereWithoutSessionInput[]
    deleteMany?: EventScalarWhereInput | EventScalarWhereInput[]
  }

  export type WebsiteCreateNestedOneWithoutEventsInput = {
    create?: XOR<WebsiteCreateWithoutEventsInput, WebsiteUncheckedCreateWithoutEventsInput>
    connectOrCreate?: WebsiteCreateOrConnectWithoutEventsInput
    connect?: WebsiteWhereUniqueInput
  }

  export type SessionCreateNestedOneWithoutEventsInput = {
    create?: XOR<SessionCreateWithoutEventsInput, SessionUncheckedCreateWithoutEventsInput>
    connectOrCreate?: SessionCreateOrConnectWithoutEventsInput
    connect?: SessionWhereUniqueInput
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type WebsiteUpdateOneRequiredWithoutEventsNestedInput = {
    create?: XOR<WebsiteCreateWithoutEventsInput, WebsiteUncheckedCreateWithoutEventsInput>
    connectOrCreate?: WebsiteCreateOrConnectWithoutEventsInput
    upsert?: WebsiteUpsertWithoutEventsInput
    connect?: WebsiteWhereUniqueInput
    update?: XOR<XOR<WebsiteUpdateToOneWithWhereWithoutEventsInput, WebsiteUpdateWithoutEventsInput>, WebsiteUncheckedUpdateWithoutEventsInput>
  }

  export type SessionUpdateOneRequiredWithoutEventsNestedInput = {
    create?: XOR<SessionCreateWithoutEventsInput, SessionUncheckedCreateWithoutEventsInput>
    connectOrCreate?: SessionCreateOrConnectWithoutEventsInput
    upsert?: SessionUpsertWithoutEventsInput
    connect?: SessionWhereUniqueInput
    update?: XOR<XOR<SessionUpdateToOneWithWhereWithoutEventsInput, SessionUpdateWithoutEventsInput>, SessionUncheckedUpdateWithoutEventsInput>
  }

  export type WebsiteCreateNestedOneWithoutPrincipalsInput = {
    create?: XOR<WebsiteCreateWithoutPrincipalsInput, WebsiteUncheckedCreateWithoutPrincipalsInput>
    connectOrCreate?: WebsiteCreateOrConnectWithoutPrincipalsInput
    connect?: WebsiteWhereUniqueInput
  }

  export type ConsentRecordCreateNestedManyWithoutPrincipalInput = {
    create?: XOR<ConsentRecordCreateWithoutPrincipalInput, ConsentRecordUncheckedCreateWithoutPrincipalInput> | ConsentRecordCreateWithoutPrincipalInput[] | ConsentRecordUncheckedCreateWithoutPrincipalInput[]
    connectOrCreate?: ConsentRecordCreateOrConnectWithoutPrincipalInput | ConsentRecordCreateOrConnectWithoutPrincipalInput[]
    createMany?: ConsentRecordCreateManyPrincipalInputEnvelope
    connect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
  }

  export type ConsentRecordUncheckedCreateNestedManyWithoutPrincipalInput = {
    create?: XOR<ConsentRecordCreateWithoutPrincipalInput, ConsentRecordUncheckedCreateWithoutPrincipalInput> | ConsentRecordCreateWithoutPrincipalInput[] | ConsentRecordUncheckedCreateWithoutPrincipalInput[]
    connectOrCreate?: ConsentRecordCreateOrConnectWithoutPrincipalInput | ConsentRecordCreateOrConnectWithoutPrincipalInput[]
    createMany?: ConsentRecordCreateManyPrincipalInputEnvelope
    connect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
  }

  export type WebsiteUpdateOneRequiredWithoutPrincipalsNestedInput = {
    create?: XOR<WebsiteCreateWithoutPrincipalsInput, WebsiteUncheckedCreateWithoutPrincipalsInput>
    connectOrCreate?: WebsiteCreateOrConnectWithoutPrincipalsInput
    upsert?: WebsiteUpsertWithoutPrincipalsInput
    connect?: WebsiteWhereUniqueInput
    update?: XOR<XOR<WebsiteUpdateToOneWithWhereWithoutPrincipalsInput, WebsiteUpdateWithoutPrincipalsInput>, WebsiteUncheckedUpdateWithoutPrincipalsInput>
  }

  export type ConsentRecordUpdateManyWithoutPrincipalNestedInput = {
    create?: XOR<ConsentRecordCreateWithoutPrincipalInput, ConsentRecordUncheckedCreateWithoutPrincipalInput> | ConsentRecordCreateWithoutPrincipalInput[] | ConsentRecordUncheckedCreateWithoutPrincipalInput[]
    connectOrCreate?: ConsentRecordCreateOrConnectWithoutPrincipalInput | ConsentRecordCreateOrConnectWithoutPrincipalInput[]
    upsert?: ConsentRecordUpsertWithWhereUniqueWithoutPrincipalInput | ConsentRecordUpsertWithWhereUniqueWithoutPrincipalInput[]
    createMany?: ConsentRecordCreateManyPrincipalInputEnvelope
    set?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    disconnect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    delete?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    connect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    update?: ConsentRecordUpdateWithWhereUniqueWithoutPrincipalInput | ConsentRecordUpdateWithWhereUniqueWithoutPrincipalInput[]
    updateMany?: ConsentRecordUpdateManyWithWhereWithoutPrincipalInput | ConsentRecordUpdateManyWithWhereWithoutPrincipalInput[]
    deleteMany?: ConsentRecordScalarWhereInput | ConsentRecordScalarWhereInput[]
  }

  export type ConsentRecordUncheckedUpdateManyWithoutPrincipalNestedInput = {
    create?: XOR<ConsentRecordCreateWithoutPrincipalInput, ConsentRecordUncheckedCreateWithoutPrincipalInput> | ConsentRecordCreateWithoutPrincipalInput[] | ConsentRecordUncheckedCreateWithoutPrincipalInput[]
    connectOrCreate?: ConsentRecordCreateOrConnectWithoutPrincipalInput | ConsentRecordCreateOrConnectWithoutPrincipalInput[]
    upsert?: ConsentRecordUpsertWithWhereUniqueWithoutPrincipalInput | ConsentRecordUpsertWithWhereUniqueWithoutPrincipalInput[]
    createMany?: ConsentRecordCreateManyPrincipalInputEnvelope
    set?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    disconnect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    delete?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    connect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    update?: ConsentRecordUpdateWithWhereUniqueWithoutPrincipalInput | ConsentRecordUpdateWithWhereUniqueWithoutPrincipalInput[]
    updateMany?: ConsentRecordUpdateManyWithWhereWithoutPrincipalInput | ConsentRecordUpdateManyWithWhereWithoutPrincipalInput[]
    deleteMany?: ConsentRecordScalarWhereInput | ConsentRecordScalarWhereInput[]
  }

  export type OrganisationCreateNestedOneWithoutPurposesInput = {
    create?: XOR<OrganisationCreateWithoutPurposesInput, OrganisationUncheckedCreateWithoutPurposesInput>
    connectOrCreate?: OrganisationCreateOrConnectWithoutPurposesInput
    connect?: OrganisationWhereUniqueInput
  }

  export type NoticePurposeCreateNestedManyWithoutPurposeInput = {
    create?: XOR<NoticePurposeCreateWithoutPurposeInput, NoticePurposeUncheckedCreateWithoutPurposeInput> | NoticePurposeCreateWithoutPurposeInput[] | NoticePurposeUncheckedCreateWithoutPurposeInput[]
    connectOrCreate?: NoticePurposeCreateOrConnectWithoutPurposeInput | NoticePurposeCreateOrConnectWithoutPurposeInput[]
    createMany?: NoticePurposeCreateManyPurposeInputEnvelope
    connect?: NoticePurposeWhereUniqueInput | NoticePurposeWhereUniqueInput[]
  }

  export type ConsentRecordCreateNestedManyWithoutPurposeInput = {
    create?: XOR<ConsentRecordCreateWithoutPurposeInput, ConsentRecordUncheckedCreateWithoutPurposeInput> | ConsentRecordCreateWithoutPurposeInput[] | ConsentRecordUncheckedCreateWithoutPurposeInput[]
    connectOrCreate?: ConsentRecordCreateOrConnectWithoutPurposeInput | ConsentRecordCreateOrConnectWithoutPurposeInput[]
    createMany?: ConsentRecordCreateManyPurposeInputEnvelope
    connect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
  }

  export type NoticePurposeUncheckedCreateNestedManyWithoutPurposeInput = {
    create?: XOR<NoticePurposeCreateWithoutPurposeInput, NoticePurposeUncheckedCreateWithoutPurposeInput> | NoticePurposeCreateWithoutPurposeInput[] | NoticePurposeUncheckedCreateWithoutPurposeInput[]
    connectOrCreate?: NoticePurposeCreateOrConnectWithoutPurposeInput | NoticePurposeCreateOrConnectWithoutPurposeInput[]
    createMany?: NoticePurposeCreateManyPurposeInputEnvelope
    connect?: NoticePurposeWhereUniqueInput | NoticePurposeWhereUniqueInput[]
  }

  export type ConsentRecordUncheckedCreateNestedManyWithoutPurposeInput = {
    create?: XOR<ConsentRecordCreateWithoutPurposeInput, ConsentRecordUncheckedCreateWithoutPurposeInput> | ConsentRecordCreateWithoutPurposeInput[] | ConsentRecordUncheckedCreateWithoutPurposeInput[]
    connectOrCreate?: ConsentRecordCreateOrConnectWithoutPurposeInput | ConsentRecordCreateOrConnectWithoutPurposeInput[]
    createMany?: ConsentRecordCreateManyPurposeInputEnvelope
    connect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
  }

  export type OrganisationUpdateOneRequiredWithoutPurposesNestedInput = {
    create?: XOR<OrganisationCreateWithoutPurposesInput, OrganisationUncheckedCreateWithoutPurposesInput>
    connectOrCreate?: OrganisationCreateOrConnectWithoutPurposesInput
    upsert?: OrganisationUpsertWithoutPurposesInput
    connect?: OrganisationWhereUniqueInput
    update?: XOR<XOR<OrganisationUpdateToOneWithWhereWithoutPurposesInput, OrganisationUpdateWithoutPurposesInput>, OrganisationUncheckedUpdateWithoutPurposesInput>
  }

  export type NoticePurposeUpdateManyWithoutPurposeNestedInput = {
    create?: XOR<NoticePurposeCreateWithoutPurposeInput, NoticePurposeUncheckedCreateWithoutPurposeInput> | NoticePurposeCreateWithoutPurposeInput[] | NoticePurposeUncheckedCreateWithoutPurposeInput[]
    connectOrCreate?: NoticePurposeCreateOrConnectWithoutPurposeInput | NoticePurposeCreateOrConnectWithoutPurposeInput[]
    upsert?: NoticePurposeUpsertWithWhereUniqueWithoutPurposeInput | NoticePurposeUpsertWithWhereUniqueWithoutPurposeInput[]
    createMany?: NoticePurposeCreateManyPurposeInputEnvelope
    set?: NoticePurposeWhereUniqueInput | NoticePurposeWhereUniqueInput[]
    disconnect?: NoticePurposeWhereUniqueInput | NoticePurposeWhereUniqueInput[]
    delete?: NoticePurposeWhereUniqueInput | NoticePurposeWhereUniqueInput[]
    connect?: NoticePurposeWhereUniqueInput | NoticePurposeWhereUniqueInput[]
    update?: NoticePurposeUpdateWithWhereUniqueWithoutPurposeInput | NoticePurposeUpdateWithWhereUniqueWithoutPurposeInput[]
    updateMany?: NoticePurposeUpdateManyWithWhereWithoutPurposeInput | NoticePurposeUpdateManyWithWhereWithoutPurposeInput[]
    deleteMany?: NoticePurposeScalarWhereInput | NoticePurposeScalarWhereInput[]
  }

  export type ConsentRecordUpdateManyWithoutPurposeNestedInput = {
    create?: XOR<ConsentRecordCreateWithoutPurposeInput, ConsentRecordUncheckedCreateWithoutPurposeInput> | ConsentRecordCreateWithoutPurposeInput[] | ConsentRecordUncheckedCreateWithoutPurposeInput[]
    connectOrCreate?: ConsentRecordCreateOrConnectWithoutPurposeInput | ConsentRecordCreateOrConnectWithoutPurposeInput[]
    upsert?: ConsentRecordUpsertWithWhereUniqueWithoutPurposeInput | ConsentRecordUpsertWithWhereUniqueWithoutPurposeInput[]
    createMany?: ConsentRecordCreateManyPurposeInputEnvelope
    set?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    disconnect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    delete?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    connect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    update?: ConsentRecordUpdateWithWhereUniqueWithoutPurposeInput | ConsentRecordUpdateWithWhereUniqueWithoutPurposeInput[]
    updateMany?: ConsentRecordUpdateManyWithWhereWithoutPurposeInput | ConsentRecordUpdateManyWithWhereWithoutPurposeInput[]
    deleteMany?: ConsentRecordScalarWhereInput | ConsentRecordScalarWhereInput[]
  }

  export type NoticePurposeUncheckedUpdateManyWithoutPurposeNestedInput = {
    create?: XOR<NoticePurposeCreateWithoutPurposeInput, NoticePurposeUncheckedCreateWithoutPurposeInput> | NoticePurposeCreateWithoutPurposeInput[] | NoticePurposeUncheckedCreateWithoutPurposeInput[]
    connectOrCreate?: NoticePurposeCreateOrConnectWithoutPurposeInput | NoticePurposeCreateOrConnectWithoutPurposeInput[]
    upsert?: NoticePurposeUpsertWithWhereUniqueWithoutPurposeInput | NoticePurposeUpsertWithWhereUniqueWithoutPurposeInput[]
    createMany?: NoticePurposeCreateManyPurposeInputEnvelope
    set?: NoticePurposeWhereUniqueInput | NoticePurposeWhereUniqueInput[]
    disconnect?: NoticePurposeWhereUniqueInput | NoticePurposeWhereUniqueInput[]
    delete?: NoticePurposeWhereUniqueInput | NoticePurposeWhereUniqueInput[]
    connect?: NoticePurposeWhereUniqueInput | NoticePurposeWhereUniqueInput[]
    update?: NoticePurposeUpdateWithWhereUniqueWithoutPurposeInput | NoticePurposeUpdateWithWhereUniqueWithoutPurposeInput[]
    updateMany?: NoticePurposeUpdateManyWithWhereWithoutPurposeInput | NoticePurposeUpdateManyWithWhereWithoutPurposeInput[]
    deleteMany?: NoticePurposeScalarWhereInput | NoticePurposeScalarWhereInput[]
  }

  export type ConsentRecordUncheckedUpdateManyWithoutPurposeNestedInput = {
    create?: XOR<ConsentRecordCreateWithoutPurposeInput, ConsentRecordUncheckedCreateWithoutPurposeInput> | ConsentRecordCreateWithoutPurposeInput[] | ConsentRecordUncheckedCreateWithoutPurposeInput[]
    connectOrCreate?: ConsentRecordCreateOrConnectWithoutPurposeInput | ConsentRecordCreateOrConnectWithoutPurposeInput[]
    upsert?: ConsentRecordUpsertWithWhereUniqueWithoutPurposeInput | ConsentRecordUpsertWithWhereUniqueWithoutPurposeInput[]
    createMany?: ConsentRecordCreateManyPurposeInputEnvelope
    set?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    disconnect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    delete?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    connect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    update?: ConsentRecordUpdateWithWhereUniqueWithoutPurposeInput | ConsentRecordUpdateWithWhereUniqueWithoutPurposeInput[]
    updateMany?: ConsentRecordUpdateManyWithWhereWithoutPurposeInput | ConsentRecordUpdateManyWithWhereWithoutPurposeInput[]
    deleteMany?: ConsentRecordScalarWhereInput | ConsentRecordScalarWhereInput[]
  }

  export type OrganisationCreateNestedOneWithoutPoliciesInput = {
    create?: XOR<OrganisationCreateWithoutPoliciesInput, OrganisationUncheckedCreateWithoutPoliciesInput>
    connectOrCreate?: OrganisationCreateOrConnectWithoutPoliciesInput
    connect?: OrganisationWhereUniqueInput
  }

  export type PolicyVersionCreateNestedManyWithoutPolicyInput = {
    create?: XOR<PolicyVersionCreateWithoutPolicyInput, PolicyVersionUncheckedCreateWithoutPolicyInput> | PolicyVersionCreateWithoutPolicyInput[] | PolicyVersionUncheckedCreateWithoutPolicyInput[]
    connectOrCreate?: PolicyVersionCreateOrConnectWithoutPolicyInput | PolicyVersionCreateOrConnectWithoutPolicyInput[]
    createMany?: PolicyVersionCreateManyPolicyInputEnvelope
    connect?: PolicyVersionWhereUniqueInput | PolicyVersionWhereUniqueInput[]
  }

  export type PolicyVersionUncheckedCreateNestedManyWithoutPolicyInput = {
    create?: XOR<PolicyVersionCreateWithoutPolicyInput, PolicyVersionUncheckedCreateWithoutPolicyInput> | PolicyVersionCreateWithoutPolicyInput[] | PolicyVersionUncheckedCreateWithoutPolicyInput[]
    connectOrCreate?: PolicyVersionCreateOrConnectWithoutPolicyInput | PolicyVersionCreateOrConnectWithoutPolicyInput[]
    createMany?: PolicyVersionCreateManyPolicyInputEnvelope
    connect?: PolicyVersionWhereUniqueInput | PolicyVersionWhereUniqueInput[]
  }

  export type OrganisationUpdateOneRequiredWithoutPoliciesNestedInput = {
    create?: XOR<OrganisationCreateWithoutPoliciesInput, OrganisationUncheckedCreateWithoutPoliciesInput>
    connectOrCreate?: OrganisationCreateOrConnectWithoutPoliciesInput
    upsert?: OrganisationUpsertWithoutPoliciesInput
    connect?: OrganisationWhereUniqueInput
    update?: XOR<XOR<OrganisationUpdateToOneWithWhereWithoutPoliciesInput, OrganisationUpdateWithoutPoliciesInput>, OrganisationUncheckedUpdateWithoutPoliciesInput>
  }

  export type PolicyVersionUpdateManyWithoutPolicyNestedInput = {
    create?: XOR<PolicyVersionCreateWithoutPolicyInput, PolicyVersionUncheckedCreateWithoutPolicyInput> | PolicyVersionCreateWithoutPolicyInput[] | PolicyVersionUncheckedCreateWithoutPolicyInput[]
    connectOrCreate?: PolicyVersionCreateOrConnectWithoutPolicyInput | PolicyVersionCreateOrConnectWithoutPolicyInput[]
    upsert?: PolicyVersionUpsertWithWhereUniqueWithoutPolicyInput | PolicyVersionUpsertWithWhereUniqueWithoutPolicyInput[]
    createMany?: PolicyVersionCreateManyPolicyInputEnvelope
    set?: PolicyVersionWhereUniqueInput | PolicyVersionWhereUniqueInput[]
    disconnect?: PolicyVersionWhereUniqueInput | PolicyVersionWhereUniqueInput[]
    delete?: PolicyVersionWhereUniqueInput | PolicyVersionWhereUniqueInput[]
    connect?: PolicyVersionWhereUniqueInput | PolicyVersionWhereUniqueInput[]
    update?: PolicyVersionUpdateWithWhereUniqueWithoutPolicyInput | PolicyVersionUpdateWithWhereUniqueWithoutPolicyInput[]
    updateMany?: PolicyVersionUpdateManyWithWhereWithoutPolicyInput | PolicyVersionUpdateManyWithWhereWithoutPolicyInput[]
    deleteMany?: PolicyVersionScalarWhereInput | PolicyVersionScalarWhereInput[]
  }

  export type PolicyVersionUncheckedUpdateManyWithoutPolicyNestedInput = {
    create?: XOR<PolicyVersionCreateWithoutPolicyInput, PolicyVersionUncheckedCreateWithoutPolicyInput> | PolicyVersionCreateWithoutPolicyInput[] | PolicyVersionUncheckedCreateWithoutPolicyInput[]
    connectOrCreate?: PolicyVersionCreateOrConnectWithoutPolicyInput | PolicyVersionCreateOrConnectWithoutPolicyInput[]
    upsert?: PolicyVersionUpsertWithWhereUniqueWithoutPolicyInput | PolicyVersionUpsertWithWhereUniqueWithoutPolicyInput[]
    createMany?: PolicyVersionCreateManyPolicyInputEnvelope
    set?: PolicyVersionWhereUniqueInput | PolicyVersionWhereUniqueInput[]
    disconnect?: PolicyVersionWhereUniqueInput | PolicyVersionWhereUniqueInput[]
    delete?: PolicyVersionWhereUniqueInput | PolicyVersionWhereUniqueInput[]
    connect?: PolicyVersionWhereUniqueInput | PolicyVersionWhereUniqueInput[]
    update?: PolicyVersionUpdateWithWhereUniqueWithoutPolicyInput | PolicyVersionUpdateWithWhereUniqueWithoutPolicyInput[]
    updateMany?: PolicyVersionUpdateManyWithWhereWithoutPolicyInput | PolicyVersionUpdateManyWithWhereWithoutPolicyInput[]
    deleteMany?: PolicyVersionScalarWhereInput | PolicyVersionScalarWhereInput[]
  }

  export type PolicyCreateNestedOneWithoutVersionsInput = {
    create?: XOR<PolicyCreateWithoutVersionsInput, PolicyUncheckedCreateWithoutVersionsInput>
    connectOrCreate?: PolicyCreateOrConnectWithoutVersionsInput
    connect?: PolicyWhereUniqueInput
  }

  export type NoticeCreateNestedManyWithoutPolicyVersionInput = {
    create?: XOR<NoticeCreateWithoutPolicyVersionInput, NoticeUncheckedCreateWithoutPolicyVersionInput> | NoticeCreateWithoutPolicyVersionInput[] | NoticeUncheckedCreateWithoutPolicyVersionInput[]
    connectOrCreate?: NoticeCreateOrConnectWithoutPolicyVersionInput | NoticeCreateOrConnectWithoutPolicyVersionInput[]
    createMany?: NoticeCreateManyPolicyVersionInputEnvelope
    connect?: NoticeWhereUniqueInput | NoticeWhereUniqueInput[]
  }

  export type ConsentRecordCreateNestedManyWithoutPolicyVersionInput = {
    create?: XOR<ConsentRecordCreateWithoutPolicyVersionInput, ConsentRecordUncheckedCreateWithoutPolicyVersionInput> | ConsentRecordCreateWithoutPolicyVersionInput[] | ConsentRecordUncheckedCreateWithoutPolicyVersionInput[]
    connectOrCreate?: ConsentRecordCreateOrConnectWithoutPolicyVersionInput | ConsentRecordCreateOrConnectWithoutPolicyVersionInput[]
    createMany?: ConsentRecordCreateManyPolicyVersionInputEnvelope
    connect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
  }

  export type NoticeUncheckedCreateNestedManyWithoutPolicyVersionInput = {
    create?: XOR<NoticeCreateWithoutPolicyVersionInput, NoticeUncheckedCreateWithoutPolicyVersionInput> | NoticeCreateWithoutPolicyVersionInput[] | NoticeUncheckedCreateWithoutPolicyVersionInput[]
    connectOrCreate?: NoticeCreateOrConnectWithoutPolicyVersionInput | NoticeCreateOrConnectWithoutPolicyVersionInput[]
    createMany?: NoticeCreateManyPolicyVersionInputEnvelope
    connect?: NoticeWhereUniqueInput | NoticeWhereUniqueInput[]
  }

  export type ConsentRecordUncheckedCreateNestedManyWithoutPolicyVersionInput = {
    create?: XOR<ConsentRecordCreateWithoutPolicyVersionInput, ConsentRecordUncheckedCreateWithoutPolicyVersionInput> | ConsentRecordCreateWithoutPolicyVersionInput[] | ConsentRecordUncheckedCreateWithoutPolicyVersionInput[]
    connectOrCreate?: ConsentRecordCreateOrConnectWithoutPolicyVersionInput | ConsentRecordCreateOrConnectWithoutPolicyVersionInput[]
    createMany?: ConsentRecordCreateManyPolicyVersionInputEnvelope
    connect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
  }

  export type PolicyUpdateOneRequiredWithoutVersionsNestedInput = {
    create?: XOR<PolicyCreateWithoutVersionsInput, PolicyUncheckedCreateWithoutVersionsInput>
    connectOrCreate?: PolicyCreateOrConnectWithoutVersionsInput
    upsert?: PolicyUpsertWithoutVersionsInput
    connect?: PolicyWhereUniqueInput
    update?: XOR<XOR<PolicyUpdateToOneWithWhereWithoutVersionsInput, PolicyUpdateWithoutVersionsInput>, PolicyUncheckedUpdateWithoutVersionsInput>
  }

  export type NoticeUpdateManyWithoutPolicyVersionNestedInput = {
    create?: XOR<NoticeCreateWithoutPolicyVersionInput, NoticeUncheckedCreateWithoutPolicyVersionInput> | NoticeCreateWithoutPolicyVersionInput[] | NoticeUncheckedCreateWithoutPolicyVersionInput[]
    connectOrCreate?: NoticeCreateOrConnectWithoutPolicyVersionInput | NoticeCreateOrConnectWithoutPolicyVersionInput[]
    upsert?: NoticeUpsertWithWhereUniqueWithoutPolicyVersionInput | NoticeUpsertWithWhereUniqueWithoutPolicyVersionInput[]
    createMany?: NoticeCreateManyPolicyVersionInputEnvelope
    set?: NoticeWhereUniqueInput | NoticeWhereUniqueInput[]
    disconnect?: NoticeWhereUniqueInput | NoticeWhereUniqueInput[]
    delete?: NoticeWhereUniqueInput | NoticeWhereUniqueInput[]
    connect?: NoticeWhereUniqueInput | NoticeWhereUniqueInput[]
    update?: NoticeUpdateWithWhereUniqueWithoutPolicyVersionInput | NoticeUpdateWithWhereUniqueWithoutPolicyVersionInput[]
    updateMany?: NoticeUpdateManyWithWhereWithoutPolicyVersionInput | NoticeUpdateManyWithWhereWithoutPolicyVersionInput[]
    deleteMany?: NoticeScalarWhereInput | NoticeScalarWhereInput[]
  }

  export type ConsentRecordUpdateManyWithoutPolicyVersionNestedInput = {
    create?: XOR<ConsentRecordCreateWithoutPolicyVersionInput, ConsentRecordUncheckedCreateWithoutPolicyVersionInput> | ConsentRecordCreateWithoutPolicyVersionInput[] | ConsentRecordUncheckedCreateWithoutPolicyVersionInput[]
    connectOrCreate?: ConsentRecordCreateOrConnectWithoutPolicyVersionInput | ConsentRecordCreateOrConnectWithoutPolicyVersionInput[]
    upsert?: ConsentRecordUpsertWithWhereUniqueWithoutPolicyVersionInput | ConsentRecordUpsertWithWhereUniqueWithoutPolicyVersionInput[]
    createMany?: ConsentRecordCreateManyPolicyVersionInputEnvelope
    set?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    disconnect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    delete?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    connect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    update?: ConsentRecordUpdateWithWhereUniqueWithoutPolicyVersionInput | ConsentRecordUpdateWithWhereUniqueWithoutPolicyVersionInput[]
    updateMany?: ConsentRecordUpdateManyWithWhereWithoutPolicyVersionInput | ConsentRecordUpdateManyWithWhereWithoutPolicyVersionInput[]
    deleteMany?: ConsentRecordScalarWhereInput | ConsentRecordScalarWhereInput[]
  }

  export type NoticeUncheckedUpdateManyWithoutPolicyVersionNestedInput = {
    create?: XOR<NoticeCreateWithoutPolicyVersionInput, NoticeUncheckedCreateWithoutPolicyVersionInput> | NoticeCreateWithoutPolicyVersionInput[] | NoticeUncheckedCreateWithoutPolicyVersionInput[]
    connectOrCreate?: NoticeCreateOrConnectWithoutPolicyVersionInput | NoticeCreateOrConnectWithoutPolicyVersionInput[]
    upsert?: NoticeUpsertWithWhereUniqueWithoutPolicyVersionInput | NoticeUpsertWithWhereUniqueWithoutPolicyVersionInput[]
    createMany?: NoticeCreateManyPolicyVersionInputEnvelope
    set?: NoticeWhereUniqueInput | NoticeWhereUniqueInput[]
    disconnect?: NoticeWhereUniqueInput | NoticeWhereUniqueInput[]
    delete?: NoticeWhereUniqueInput | NoticeWhereUniqueInput[]
    connect?: NoticeWhereUniqueInput | NoticeWhereUniqueInput[]
    update?: NoticeUpdateWithWhereUniqueWithoutPolicyVersionInput | NoticeUpdateWithWhereUniqueWithoutPolicyVersionInput[]
    updateMany?: NoticeUpdateManyWithWhereWithoutPolicyVersionInput | NoticeUpdateManyWithWhereWithoutPolicyVersionInput[]
    deleteMany?: NoticeScalarWhereInput | NoticeScalarWhereInput[]
  }

  export type ConsentRecordUncheckedUpdateManyWithoutPolicyVersionNestedInput = {
    create?: XOR<ConsentRecordCreateWithoutPolicyVersionInput, ConsentRecordUncheckedCreateWithoutPolicyVersionInput> | ConsentRecordCreateWithoutPolicyVersionInput[] | ConsentRecordUncheckedCreateWithoutPolicyVersionInput[]
    connectOrCreate?: ConsentRecordCreateOrConnectWithoutPolicyVersionInput | ConsentRecordCreateOrConnectWithoutPolicyVersionInput[]
    upsert?: ConsentRecordUpsertWithWhereUniqueWithoutPolicyVersionInput | ConsentRecordUpsertWithWhereUniqueWithoutPolicyVersionInput[]
    createMany?: ConsentRecordCreateManyPolicyVersionInputEnvelope
    set?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    disconnect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    delete?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    connect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    update?: ConsentRecordUpdateWithWhereUniqueWithoutPolicyVersionInput | ConsentRecordUpdateWithWhereUniqueWithoutPolicyVersionInput[]
    updateMany?: ConsentRecordUpdateManyWithWhereWithoutPolicyVersionInput | ConsentRecordUpdateManyWithWhereWithoutPolicyVersionInput[]
    deleteMany?: ConsentRecordScalarWhereInput | ConsentRecordScalarWhereInput[]
  }

  export type OrganisationCreateNestedOneWithoutNoticesInput = {
    create?: XOR<OrganisationCreateWithoutNoticesInput, OrganisationUncheckedCreateWithoutNoticesInput>
    connectOrCreate?: OrganisationCreateOrConnectWithoutNoticesInput
    connect?: OrganisationWhereUniqueInput
  }

  export type PolicyVersionCreateNestedOneWithoutNoticesInput = {
    create?: XOR<PolicyVersionCreateWithoutNoticesInput, PolicyVersionUncheckedCreateWithoutNoticesInput>
    connectOrCreate?: PolicyVersionCreateOrConnectWithoutNoticesInput
    connect?: PolicyVersionWhereUniqueInput
  }

  export type NoticePurposeCreateNestedManyWithoutNoticeInput = {
    create?: XOR<NoticePurposeCreateWithoutNoticeInput, NoticePurposeUncheckedCreateWithoutNoticeInput> | NoticePurposeCreateWithoutNoticeInput[] | NoticePurposeUncheckedCreateWithoutNoticeInput[]
    connectOrCreate?: NoticePurposeCreateOrConnectWithoutNoticeInput | NoticePurposeCreateOrConnectWithoutNoticeInput[]
    createMany?: NoticePurposeCreateManyNoticeInputEnvelope
    connect?: NoticePurposeWhereUniqueInput | NoticePurposeWhereUniqueInput[]
  }

  export type ConsentRecordCreateNestedManyWithoutNoticeInput = {
    create?: XOR<ConsentRecordCreateWithoutNoticeInput, ConsentRecordUncheckedCreateWithoutNoticeInput> | ConsentRecordCreateWithoutNoticeInput[] | ConsentRecordUncheckedCreateWithoutNoticeInput[]
    connectOrCreate?: ConsentRecordCreateOrConnectWithoutNoticeInput | ConsentRecordCreateOrConnectWithoutNoticeInput[]
    createMany?: ConsentRecordCreateManyNoticeInputEnvelope
    connect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
  }

  export type NoticePurposeUncheckedCreateNestedManyWithoutNoticeInput = {
    create?: XOR<NoticePurposeCreateWithoutNoticeInput, NoticePurposeUncheckedCreateWithoutNoticeInput> | NoticePurposeCreateWithoutNoticeInput[] | NoticePurposeUncheckedCreateWithoutNoticeInput[]
    connectOrCreate?: NoticePurposeCreateOrConnectWithoutNoticeInput | NoticePurposeCreateOrConnectWithoutNoticeInput[]
    createMany?: NoticePurposeCreateManyNoticeInputEnvelope
    connect?: NoticePurposeWhereUniqueInput | NoticePurposeWhereUniqueInput[]
  }

  export type ConsentRecordUncheckedCreateNestedManyWithoutNoticeInput = {
    create?: XOR<ConsentRecordCreateWithoutNoticeInput, ConsentRecordUncheckedCreateWithoutNoticeInput> | ConsentRecordCreateWithoutNoticeInput[] | ConsentRecordUncheckedCreateWithoutNoticeInput[]
    connectOrCreate?: ConsentRecordCreateOrConnectWithoutNoticeInput | ConsentRecordCreateOrConnectWithoutNoticeInput[]
    createMany?: ConsentRecordCreateManyNoticeInputEnvelope
    connect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
  }

  export type OrganisationUpdateOneRequiredWithoutNoticesNestedInput = {
    create?: XOR<OrganisationCreateWithoutNoticesInput, OrganisationUncheckedCreateWithoutNoticesInput>
    connectOrCreate?: OrganisationCreateOrConnectWithoutNoticesInput
    upsert?: OrganisationUpsertWithoutNoticesInput
    connect?: OrganisationWhereUniqueInput
    update?: XOR<XOR<OrganisationUpdateToOneWithWhereWithoutNoticesInput, OrganisationUpdateWithoutNoticesInput>, OrganisationUncheckedUpdateWithoutNoticesInput>
  }

  export type PolicyVersionUpdateOneRequiredWithoutNoticesNestedInput = {
    create?: XOR<PolicyVersionCreateWithoutNoticesInput, PolicyVersionUncheckedCreateWithoutNoticesInput>
    connectOrCreate?: PolicyVersionCreateOrConnectWithoutNoticesInput
    upsert?: PolicyVersionUpsertWithoutNoticesInput
    connect?: PolicyVersionWhereUniqueInput
    update?: XOR<XOR<PolicyVersionUpdateToOneWithWhereWithoutNoticesInput, PolicyVersionUpdateWithoutNoticesInput>, PolicyVersionUncheckedUpdateWithoutNoticesInput>
  }

  export type NoticePurposeUpdateManyWithoutNoticeNestedInput = {
    create?: XOR<NoticePurposeCreateWithoutNoticeInput, NoticePurposeUncheckedCreateWithoutNoticeInput> | NoticePurposeCreateWithoutNoticeInput[] | NoticePurposeUncheckedCreateWithoutNoticeInput[]
    connectOrCreate?: NoticePurposeCreateOrConnectWithoutNoticeInput | NoticePurposeCreateOrConnectWithoutNoticeInput[]
    upsert?: NoticePurposeUpsertWithWhereUniqueWithoutNoticeInput | NoticePurposeUpsertWithWhereUniqueWithoutNoticeInput[]
    createMany?: NoticePurposeCreateManyNoticeInputEnvelope
    set?: NoticePurposeWhereUniqueInput | NoticePurposeWhereUniqueInput[]
    disconnect?: NoticePurposeWhereUniqueInput | NoticePurposeWhereUniqueInput[]
    delete?: NoticePurposeWhereUniqueInput | NoticePurposeWhereUniqueInput[]
    connect?: NoticePurposeWhereUniqueInput | NoticePurposeWhereUniqueInput[]
    update?: NoticePurposeUpdateWithWhereUniqueWithoutNoticeInput | NoticePurposeUpdateWithWhereUniqueWithoutNoticeInput[]
    updateMany?: NoticePurposeUpdateManyWithWhereWithoutNoticeInput | NoticePurposeUpdateManyWithWhereWithoutNoticeInput[]
    deleteMany?: NoticePurposeScalarWhereInput | NoticePurposeScalarWhereInput[]
  }

  export type ConsentRecordUpdateManyWithoutNoticeNestedInput = {
    create?: XOR<ConsentRecordCreateWithoutNoticeInput, ConsentRecordUncheckedCreateWithoutNoticeInput> | ConsentRecordCreateWithoutNoticeInput[] | ConsentRecordUncheckedCreateWithoutNoticeInput[]
    connectOrCreate?: ConsentRecordCreateOrConnectWithoutNoticeInput | ConsentRecordCreateOrConnectWithoutNoticeInput[]
    upsert?: ConsentRecordUpsertWithWhereUniqueWithoutNoticeInput | ConsentRecordUpsertWithWhereUniqueWithoutNoticeInput[]
    createMany?: ConsentRecordCreateManyNoticeInputEnvelope
    set?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    disconnect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    delete?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    connect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    update?: ConsentRecordUpdateWithWhereUniqueWithoutNoticeInput | ConsentRecordUpdateWithWhereUniqueWithoutNoticeInput[]
    updateMany?: ConsentRecordUpdateManyWithWhereWithoutNoticeInput | ConsentRecordUpdateManyWithWhereWithoutNoticeInput[]
    deleteMany?: ConsentRecordScalarWhereInput | ConsentRecordScalarWhereInput[]
  }

  export type NoticePurposeUncheckedUpdateManyWithoutNoticeNestedInput = {
    create?: XOR<NoticePurposeCreateWithoutNoticeInput, NoticePurposeUncheckedCreateWithoutNoticeInput> | NoticePurposeCreateWithoutNoticeInput[] | NoticePurposeUncheckedCreateWithoutNoticeInput[]
    connectOrCreate?: NoticePurposeCreateOrConnectWithoutNoticeInput | NoticePurposeCreateOrConnectWithoutNoticeInput[]
    upsert?: NoticePurposeUpsertWithWhereUniqueWithoutNoticeInput | NoticePurposeUpsertWithWhereUniqueWithoutNoticeInput[]
    createMany?: NoticePurposeCreateManyNoticeInputEnvelope
    set?: NoticePurposeWhereUniqueInput | NoticePurposeWhereUniqueInput[]
    disconnect?: NoticePurposeWhereUniqueInput | NoticePurposeWhereUniqueInput[]
    delete?: NoticePurposeWhereUniqueInput | NoticePurposeWhereUniqueInput[]
    connect?: NoticePurposeWhereUniqueInput | NoticePurposeWhereUniqueInput[]
    update?: NoticePurposeUpdateWithWhereUniqueWithoutNoticeInput | NoticePurposeUpdateWithWhereUniqueWithoutNoticeInput[]
    updateMany?: NoticePurposeUpdateManyWithWhereWithoutNoticeInput | NoticePurposeUpdateManyWithWhereWithoutNoticeInput[]
    deleteMany?: NoticePurposeScalarWhereInput | NoticePurposeScalarWhereInput[]
  }

  export type ConsentRecordUncheckedUpdateManyWithoutNoticeNestedInput = {
    create?: XOR<ConsentRecordCreateWithoutNoticeInput, ConsentRecordUncheckedCreateWithoutNoticeInput> | ConsentRecordCreateWithoutNoticeInput[] | ConsentRecordUncheckedCreateWithoutNoticeInput[]
    connectOrCreate?: ConsentRecordCreateOrConnectWithoutNoticeInput | ConsentRecordCreateOrConnectWithoutNoticeInput[]
    upsert?: ConsentRecordUpsertWithWhereUniqueWithoutNoticeInput | ConsentRecordUpsertWithWhereUniqueWithoutNoticeInput[]
    createMany?: ConsentRecordCreateManyNoticeInputEnvelope
    set?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    disconnect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    delete?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    connect?: ConsentRecordWhereUniqueInput | ConsentRecordWhereUniqueInput[]
    update?: ConsentRecordUpdateWithWhereUniqueWithoutNoticeInput | ConsentRecordUpdateWithWhereUniqueWithoutNoticeInput[]
    updateMany?: ConsentRecordUpdateManyWithWhereWithoutNoticeInput | ConsentRecordUpdateManyWithWhereWithoutNoticeInput[]
    deleteMany?: ConsentRecordScalarWhereInput | ConsentRecordScalarWhereInput[]
  }

  export type NoticeCreateNestedOneWithoutPurposesInput = {
    create?: XOR<NoticeCreateWithoutPurposesInput, NoticeUncheckedCreateWithoutPurposesInput>
    connectOrCreate?: NoticeCreateOrConnectWithoutPurposesInput
    connect?: NoticeWhereUniqueInput
  }

  export type PurposeCreateNestedOneWithoutNoticePurposesInput = {
    create?: XOR<PurposeCreateWithoutNoticePurposesInput, PurposeUncheckedCreateWithoutNoticePurposesInput>
    connectOrCreate?: PurposeCreateOrConnectWithoutNoticePurposesInput
    connect?: PurposeWhereUniqueInput
  }

  export type NoticeUpdateOneRequiredWithoutPurposesNestedInput = {
    create?: XOR<NoticeCreateWithoutPurposesInput, NoticeUncheckedCreateWithoutPurposesInput>
    connectOrCreate?: NoticeCreateOrConnectWithoutPurposesInput
    upsert?: NoticeUpsertWithoutPurposesInput
    connect?: NoticeWhereUniqueInput
    update?: XOR<XOR<NoticeUpdateToOneWithWhereWithoutPurposesInput, NoticeUpdateWithoutPurposesInput>, NoticeUncheckedUpdateWithoutPurposesInput>
  }

  export type PurposeUpdateOneRequiredWithoutNoticePurposesNestedInput = {
    create?: XOR<PurposeCreateWithoutNoticePurposesInput, PurposeUncheckedCreateWithoutNoticePurposesInput>
    connectOrCreate?: PurposeCreateOrConnectWithoutNoticePurposesInput
    upsert?: PurposeUpsertWithoutNoticePurposesInput
    connect?: PurposeWhereUniqueInput
    update?: XOR<XOR<PurposeUpdateToOneWithWhereWithoutNoticePurposesInput, PurposeUpdateWithoutNoticePurposesInput>, PurposeUncheckedUpdateWithoutNoticePurposesInput>
  }

  export type WebsiteCreateNestedOneWithoutConsentRecordsInput = {
    create?: XOR<WebsiteCreateWithoutConsentRecordsInput, WebsiteUncheckedCreateWithoutConsentRecordsInput>
    connectOrCreate?: WebsiteCreateOrConnectWithoutConsentRecordsInput
    connect?: WebsiteWhereUniqueInput
  }

  export type PrincipalCreateNestedOneWithoutConsentRecordsInput = {
    create?: XOR<PrincipalCreateWithoutConsentRecordsInput, PrincipalUncheckedCreateWithoutConsentRecordsInput>
    connectOrCreate?: PrincipalCreateOrConnectWithoutConsentRecordsInput
    connect?: PrincipalWhereUniqueInput
  }

  export type PurposeCreateNestedOneWithoutConsentRecordsInput = {
    create?: XOR<PurposeCreateWithoutConsentRecordsInput, PurposeUncheckedCreateWithoutConsentRecordsInput>
    connectOrCreate?: PurposeCreateOrConnectWithoutConsentRecordsInput
    connect?: PurposeWhereUniqueInput
  }

  export type NoticeCreateNestedOneWithoutConsentRecordsInput = {
    create?: XOR<NoticeCreateWithoutConsentRecordsInput, NoticeUncheckedCreateWithoutConsentRecordsInput>
    connectOrCreate?: NoticeCreateOrConnectWithoutConsentRecordsInput
    connect?: NoticeWhereUniqueInput
  }

  export type PolicyVersionCreateNestedOneWithoutConsentRecordsInput = {
    create?: XOR<PolicyVersionCreateWithoutConsentRecordsInput, PolicyVersionUncheckedCreateWithoutConsentRecordsInput>
    connectOrCreate?: PolicyVersionCreateOrConnectWithoutConsentRecordsInput
    connect?: PolicyVersionWhereUniqueInput
  }

  export type WebsiteUpdateOneRequiredWithoutConsentRecordsNestedInput = {
    create?: XOR<WebsiteCreateWithoutConsentRecordsInput, WebsiteUncheckedCreateWithoutConsentRecordsInput>
    connectOrCreate?: WebsiteCreateOrConnectWithoutConsentRecordsInput
    upsert?: WebsiteUpsertWithoutConsentRecordsInput
    connect?: WebsiteWhereUniqueInput
    update?: XOR<XOR<WebsiteUpdateToOneWithWhereWithoutConsentRecordsInput, WebsiteUpdateWithoutConsentRecordsInput>, WebsiteUncheckedUpdateWithoutConsentRecordsInput>
  }

  export type PrincipalUpdateOneRequiredWithoutConsentRecordsNestedInput = {
    create?: XOR<PrincipalCreateWithoutConsentRecordsInput, PrincipalUncheckedCreateWithoutConsentRecordsInput>
    connectOrCreate?: PrincipalCreateOrConnectWithoutConsentRecordsInput
    upsert?: PrincipalUpsertWithoutConsentRecordsInput
    connect?: PrincipalWhereUniqueInput
    update?: XOR<XOR<PrincipalUpdateToOneWithWhereWithoutConsentRecordsInput, PrincipalUpdateWithoutConsentRecordsInput>, PrincipalUncheckedUpdateWithoutConsentRecordsInput>
  }

  export type PurposeUpdateOneRequiredWithoutConsentRecordsNestedInput = {
    create?: XOR<PurposeCreateWithoutConsentRecordsInput, PurposeUncheckedCreateWithoutConsentRecordsInput>
    connectOrCreate?: PurposeCreateOrConnectWithoutConsentRecordsInput
    upsert?: PurposeUpsertWithoutConsentRecordsInput
    connect?: PurposeWhereUniqueInput
    update?: XOR<XOR<PurposeUpdateToOneWithWhereWithoutConsentRecordsInput, PurposeUpdateWithoutConsentRecordsInput>, PurposeUncheckedUpdateWithoutConsentRecordsInput>
  }

  export type NoticeUpdateOneWithoutConsentRecordsNestedInput = {
    create?: XOR<NoticeCreateWithoutConsentRecordsInput, NoticeUncheckedCreateWithoutConsentRecordsInput>
    connectOrCreate?: NoticeCreateOrConnectWithoutConsentRecordsInput
    upsert?: NoticeUpsertWithoutConsentRecordsInput
    disconnect?: NoticeWhereInput | boolean
    delete?: NoticeWhereInput | boolean
    connect?: NoticeWhereUniqueInput
    update?: XOR<XOR<NoticeUpdateToOneWithWhereWithoutConsentRecordsInput, NoticeUpdateWithoutConsentRecordsInput>, NoticeUncheckedUpdateWithoutConsentRecordsInput>
  }

  export type PolicyVersionUpdateOneWithoutConsentRecordsNestedInput = {
    create?: XOR<PolicyVersionCreateWithoutConsentRecordsInput, PolicyVersionUncheckedCreateWithoutConsentRecordsInput>
    connectOrCreate?: PolicyVersionCreateOrConnectWithoutConsentRecordsInput
    upsert?: PolicyVersionUpsertWithoutConsentRecordsInput
    disconnect?: PolicyVersionWhereInput | boolean
    delete?: PolicyVersionWhereInput | boolean
    connect?: PolicyVersionWhereUniqueInput
    update?: XOR<XOR<PolicyVersionUpdateToOneWithWhereWithoutConsentRecordsInput, PolicyVersionUpdateWithoutConsentRecordsInput>, PolicyVersionUncheckedUpdateWithoutConsentRecordsInput>
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }
  export type NestedJsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<NestedJsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type WebsiteCreateWithoutOrganisationInput = {
    id?: string
    name: string
    domain: string
    publicKey: string
    isActive?: boolean
    createdAt?: Date | string
    sessions?: SessionCreateNestedManyWithoutWebsiteInput
    events?: EventCreateNestedManyWithoutWebsiteInput
    principals?: PrincipalCreateNestedManyWithoutWebsiteInput
    consentRecords?: ConsentRecordCreateNestedManyWithoutWebsiteInput
  }

  export type WebsiteUncheckedCreateWithoutOrganisationInput = {
    id?: string
    name: string
    domain: string
    publicKey: string
    isActive?: boolean
    createdAt?: Date | string
    sessions?: SessionUncheckedCreateNestedManyWithoutWebsiteInput
    events?: EventUncheckedCreateNestedManyWithoutWebsiteInput
    principals?: PrincipalUncheckedCreateNestedManyWithoutWebsiteInput
    consentRecords?: ConsentRecordUncheckedCreateNestedManyWithoutWebsiteInput
  }

  export type WebsiteCreateOrConnectWithoutOrganisationInput = {
    where: WebsiteWhereUniqueInput
    create: XOR<WebsiteCreateWithoutOrganisationInput, WebsiteUncheckedCreateWithoutOrganisationInput>
  }

  export type WebsiteCreateManyOrganisationInputEnvelope = {
    data: WebsiteCreateManyOrganisationInput | WebsiteCreateManyOrganisationInput[]
    skipDuplicates?: boolean
  }

  export type PurposeCreateWithoutOrganisationInput = {
    id?: string
    code: string
    name: string
    description: string
    isActive?: boolean
    createdAt?: Date | string
    noticePurposes?: NoticePurposeCreateNestedManyWithoutPurposeInput
    consentRecords?: ConsentRecordCreateNestedManyWithoutPurposeInput
  }

  export type PurposeUncheckedCreateWithoutOrganisationInput = {
    id?: string
    code: string
    name: string
    description: string
    isActive?: boolean
    createdAt?: Date | string
    noticePurposes?: NoticePurposeUncheckedCreateNestedManyWithoutPurposeInput
    consentRecords?: ConsentRecordUncheckedCreateNestedManyWithoutPurposeInput
  }

  export type PurposeCreateOrConnectWithoutOrganisationInput = {
    where: PurposeWhereUniqueInput
    create: XOR<PurposeCreateWithoutOrganisationInput, PurposeUncheckedCreateWithoutOrganisationInput>
  }

  export type PurposeCreateManyOrganisationInputEnvelope = {
    data: PurposeCreateManyOrganisationInput | PurposeCreateManyOrganisationInput[]
    skipDuplicates?: boolean
  }

  export type PolicyCreateWithoutOrganisationInput = {
    id?: string
    code: string
    name: string
    createdAt?: Date | string
    versions?: PolicyVersionCreateNestedManyWithoutPolicyInput
  }

  export type PolicyUncheckedCreateWithoutOrganisationInput = {
    id?: string
    code: string
    name: string
    createdAt?: Date | string
    versions?: PolicyVersionUncheckedCreateNestedManyWithoutPolicyInput
  }

  export type PolicyCreateOrConnectWithoutOrganisationInput = {
    where: PolicyWhereUniqueInput
    create: XOR<PolicyCreateWithoutOrganisationInput, PolicyUncheckedCreateWithoutOrganisationInput>
  }

  export type PolicyCreateManyOrganisationInputEnvelope = {
    data: PolicyCreateManyOrganisationInput | PolicyCreateManyOrganisationInput[]
    skipDuplicates?: boolean
  }

  export type NoticeCreateWithoutOrganisationInput = {
    id?: string
    version: string
    locale?: string
    publishedAt?: Date | string
    policyVersion: PolicyVersionCreateNestedOneWithoutNoticesInput
    purposes?: NoticePurposeCreateNestedManyWithoutNoticeInput
    consentRecords?: ConsentRecordCreateNestedManyWithoutNoticeInput
  }

  export type NoticeUncheckedCreateWithoutOrganisationInput = {
    id?: string
    policyVersionId: string
    version: string
    locale?: string
    publishedAt?: Date | string
    purposes?: NoticePurposeUncheckedCreateNestedManyWithoutNoticeInput
    consentRecords?: ConsentRecordUncheckedCreateNestedManyWithoutNoticeInput
  }

  export type NoticeCreateOrConnectWithoutOrganisationInput = {
    where: NoticeWhereUniqueInput
    create: XOR<NoticeCreateWithoutOrganisationInput, NoticeUncheckedCreateWithoutOrganisationInput>
  }

  export type NoticeCreateManyOrganisationInputEnvelope = {
    data: NoticeCreateManyOrganisationInput | NoticeCreateManyOrganisationInput[]
    skipDuplicates?: boolean
  }

  export type WebsiteUpsertWithWhereUniqueWithoutOrganisationInput = {
    where: WebsiteWhereUniqueInput
    update: XOR<WebsiteUpdateWithoutOrganisationInput, WebsiteUncheckedUpdateWithoutOrganisationInput>
    create: XOR<WebsiteCreateWithoutOrganisationInput, WebsiteUncheckedCreateWithoutOrganisationInput>
  }

  export type WebsiteUpdateWithWhereUniqueWithoutOrganisationInput = {
    where: WebsiteWhereUniqueInput
    data: XOR<WebsiteUpdateWithoutOrganisationInput, WebsiteUncheckedUpdateWithoutOrganisationInput>
  }

  export type WebsiteUpdateManyWithWhereWithoutOrganisationInput = {
    where: WebsiteScalarWhereInput
    data: XOR<WebsiteUpdateManyMutationInput, WebsiteUncheckedUpdateManyWithoutOrganisationInput>
  }

  export type WebsiteScalarWhereInput = {
    AND?: WebsiteScalarWhereInput | WebsiteScalarWhereInput[]
    OR?: WebsiteScalarWhereInput[]
    NOT?: WebsiteScalarWhereInput | WebsiteScalarWhereInput[]
    id?: StringFilter<"Website"> | string
    organisationId?: StringFilter<"Website"> | string
    name?: StringFilter<"Website"> | string
    domain?: StringFilter<"Website"> | string
    publicKey?: StringFilter<"Website"> | string
    isActive?: BoolFilter<"Website"> | boolean
    createdAt?: DateTimeFilter<"Website"> | Date | string
  }

  export type PurposeUpsertWithWhereUniqueWithoutOrganisationInput = {
    where: PurposeWhereUniqueInput
    update: XOR<PurposeUpdateWithoutOrganisationInput, PurposeUncheckedUpdateWithoutOrganisationInput>
    create: XOR<PurposeCreateWithoutOrganisationInput, PurposeUncheckedCreateWithoutOrganisationInput>
  }

  export type PurposeUpdateWithWhereUniqueWithoutOrganisationInput = {
    where: PurposeWhereUniqueInput
    data: XOR<PurposeUpdateWithoutOrganisationInput, PurposeUncheckedUpdateWithoutOrganisationInput>
  }

  export type PurposeUpdateManyWithWhereWithoutOrganisationInput = {
    where: PurposeScalarWhereInput
    data: XOR<PurposeUpdateManyMutationInput, PurposeUncheckedUpdateManyWithoutOrganisationInput>
  }

  export type PurposeScalarWhereInput = {
    AND?: PurposeScalarWhereInput | PurposeScalarWhereInput[]
    OR?: PurposeScalarWhereInput[]
    NOT?: PurposeScalarWhereInput | PurposeScalarWhereInput[]
    id?: StringFilter<"Purpose"> | string
    organisationId?: StringFilter<"Purpose"> | string
    code?: StringFilter<"Purpose"> | string
    name?: StringFilter<"Purpose"> | string
    description?: StringFilter<"Purpose"> | string
    isActive?: BoolFilter<"Purpose"> | boolean
    createdAt?: DateTimeFilter<"Purpose"> | Date | string
  }

  export type PolicyUpsertWithWhereUniqueWithoutOrganisationInput = {
    where: PolicyWhereUniqueInput
    update: XOR<PolicyUpdateWithoutOrganisationInput, PolicyUncheckedUpdateWithoutOrganisationInput>
    create: XOR<PolicyCreateWithoutOrganisationInput, PolicyUncheckedCreateWithoutOrganisationInput>
  }

  export type PolicyUpdateWithWhereUniqueWithoutOrganisationInput = {
    where: PolicyWhereUniqueInput
    data: XOR<PolicyUpdateWithoutOrganisationInput, PolicyUncheckedUpdateWithoutOrganisationInput>
  }

  export type PolicyUpdateManyWithWhereWithoutOrganisationInput = {
    where: PolicyScalarWhereInput
    data: XOR<PolicyUpdateManyMutationInput, PolicyUncheckedUpdateManyWithoutOrganisationInput>
  }

  export type PolicyScalarWhereInput = {
    AND?: PolicyScalarWhereInput | PolicyScalarWhereInput[]
    OR?: PolicyScalarWhereInput[]
    NOT?: PolicyScalarWhereInput | PolicyScalarWhereInput[]
    id?: StringFilter<"Policy"> | string
    organisationId?: StringFilter<"Policy"> | string
    code?: StringFilter<"Policy"> | string
    name?: StringFilter<"Policy"> | string
    createdAt?: DateTimeFilter<"Policy"> | Date | string
  }

  export type NoticeUpsertWithWhereUniqueWithoutOrganisationInput = {
    where: NoticeWhereUniqueInput
    update: XOR<NoticeUpdateWithoutOrganisationInput, NoticeUncheckedUpdateWithoutOrganisationInput>
    create: XOR<NoticeCreateWithoutOrganisationInput, NoticeUncheckedCreateWithoutOrganisationInput>
  }

  export type NoticeUpdateWithWhereUniqueWithoutOrganisationInput = {
    where: NoticeWhereUniqueInput
    data: XOR<NoticeUpdateWithoutOrganisationInput, NoticeUncheckedUpdateWithoutOrganisationInput>
  }

  export type NoticeUpdateManyWithWhereWithoutOrganisationInput = {
    where: NoticeScalarWhereInput
    data: XOR<NoticeUpdateManyMutationInput, NoticeUncheckedUpdateManyWithoutOrganisationInput>
  }

  export type NoticeScalarWhereInput = {
    AND?: NoticeScalarWhereInput | NoticeScalarWhereInput[]
    OR?: NoticeScalarWhereInput[]
    NOT?: NoticeScalarWhereInput | NoticeScalarWhereInput[]
    id?: StringFilter<"Notice"> | string
    organisationId?: StringFilter<"Notice"> | string
    policyVersionId?: StringFilter<"Notice"> | string
    version?: StringFilter<"Notice"> | string
    locale?: StringFilter<"Notice"> | string
    publishedAt?: DateTimeFilter<"Notice"> | Date | string
  }

  export type OrganisationCreateWithoutWebsitesInput = {
    id?: string
    name: string
    slug: string
    secretKeyHash: string
    createdAt?: Date | string
    purposes?: PurposeCreateNestedManyWithoutOrganisationInput
    policies?: PolicyCreateNestedManyWithoutOrganisationInput
    notices?: NoticeCreateNestedManyWithoutOrganisationInput
  }

  export type OrganisationUncheckedCreateWithoutWebsitesInput = {
    id?: string
    name: string
    slug: string
    secretKeyHash: string
    createdAt?: Date | string
    purposes?: PurposeUncheckedCreateNestedManyWithoutOrganisationInput
    policies?: PolicyUncheckedCreateNestedManyWithoutOrganisationInput
    notices?: NoticeUncheckedCreateNestedManyWithoutOrganisationInput
  }

  export type OrganisationCreateOrConnectWithoutWebsitesInput = {
    where: OrganisationWhereUniqueInput
    create: XOR<OrganisationCreateWithoutWebsitesInput, OrganisationUncheckedCreateWithoutWebsitesInput>
  }

  export type SessionCreateWithoutWebsiteInput = {
    id?: string
    startedAt?: Date | string
    lastActivity: Date | string
    events?: EventCreateNestedManyWithoutSessionInput
  }

  export type SessionUncheckedCreateWithoutWebsiteInput = {
    id?: string
    startedAt?: Date | string
    lastActivity: Date | string
    events?: EventUncheckedCreateNestedManyWithoutSessionInput
  }

  export type SessionCreateOrConnectWithoutWebsiteInput = {
    where: SessionWhereUniqueInput
    create: XOR<SessionCreateWithoutWebsiteInput, SessionUncheckedCreateWithoutWebsiteInput>
  }

  export type SessionCreateManyWebsiteInputEnvelope = {
    data: SessionCreateManyWebsiteInput | SessionCreateManyWebsiteInput[]
    skipDuplicates?: boolean
  }

  export type EventCreateWithoutWebsiteInput = {
    id?: string
    eventId: string
    eventType: string
    name?: string | null
    eventTime: Date | string
    pageUrl: string
    pageTitle: string
    referrer?: string | null
    deviceType: string
    browser: string
    os: string
    properties?: NullableJsonNullValueInput | InputJsonValue
    receivedAt?: Date | string
    session: SessionCreateNestedOneWithoutEventsInput
  }

  export type EventUncheckedCreateWithoutWebsiteInput = {
    id?: string
    eventId: string
    sessionId: string
    eventType: string
    name?: string | null
    eventTime: Date | string
    pageUrl: string
    pageTitle: string
    referrer?: string | null
    deviceType: string
    browser: string
    os: string
    properties?: NullableJsonNullValueInput | InputJsonValue
    receivedAt?: Date | string
  }

  export type EventCreateOrConnectWithoutWebsiteInput = {
    where: EventWhereUniqueInput
    create: XOR<EventCreateWithoutWebsiteInput, EventUncheckedCreateWithoutWebsiteInput>
  }

  export type EventCreateManyWebsiteInputEnvelope = {
    data: EventCreateManyWebsiteInput | EventCreateManyWebsiteInput[]
    skipDuplicates?: boolean
  }

  export type PrincipalCreateWithoutWebsiteInput = {
    id?: string
    externalId: string
    kind?: string
    createdAt?: Date | string
    consentRecords?: ConsentRecordCreateNestedManyWithoutPrincipalInput
  }

  export type PrincipalUncheckedCreateWithoutWebsiteInput = {
    id?: string
    externalId: string
    kind?: string
    createdAt?: Date | string
    consentRecords?: ConsentRecordUncheckedCreateNestedManyWithoutPrincipalInput
  }

  export type PrincipalCreateOrConnectWithoutWebsiteInput = {
    where: PrincipalWhereUniqueInput
    create: XOR<PrincipalCreateWithoutWebsiteInput, PrincipalUncheckedCreateWithoutWebsiteInput>
  }

  export type PrincipalCreateManyWebsiteInputEnvelope = {
    data: PrincipalCreateManyWebsiteInput | PrincipalCreateManyWebsiteInput[]
    skipDuplicates?: boolean
  }

  export type ConsentRecordCreateWithoutWebsiteInput = {
    id?: string
    status: string
    source?: string
    decidedAt: Date | string
    recordedAt?: Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
    principal: PrincipalCreateNestedOneWithoutConsentRecordsInput
    purpose: PurposeCreateNestedOneWithoutConsentRecordsInput
    notice?: NoticeCreateNestedOneWithoutConsentRecordsInput
    policyVersion?: PolicyVersionCreateNestedOneWithoutConsentRecordsInput
  }

  export type ConsentRecordUncheckedCreateWithoutWebsiteInput = {
    id?: string
    principalId: string
    purposeId: string
    noticeId?: string | null
    policyVersionId?: string | null
    status: string
    source?: string
    decidedAt: Date | string
    recordedAt?: Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
  }

  export type ConsentRecordCreateOrConnectWithoutWebsiteInput = {
    where: ConsentRecordWhereUniqueInput
    create: XOR<ConsentRecordCreateWithoutWebsiteInput, ConsentRecordUncheckedCreateWithoutWebsiteInput>
  }

  export type ConsentRecordCreateManyWebsiteInputEnvelope = {
    data: ConsentRecordCreateManyWebsiteInput | ConsentRecordCreateManyWebsiteInput[]
    skipDuplicates?: boolean
  }

  export type OrganisationUpsertWithoutWebsitesInput = {
    update: XOR<OrganisationUpdateWithoutWebsitesInput, OrganisationUncheckedUpdateWithoutWebsitesInput>
    create: XOR<OrganisationCreateWithoutWebsitesInput, OrganisationUncheckedCreateWithoutWebsitesInput>
    where?: OrganisationWhereInput
  }

  export type OrganisationUpdateToOneWithWhereWithoutWebsitesInput = {
    where?: OrganisationWhereInput
    data: XOR<OrganisationUpdateWithoutWebsitesInput, OrganisationUncheckedUpdateWithoutWebsitesInput>
  }

  export type OrganisationUpdateWithoutWebsitesInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    secretKeyHash?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    purposes?: PurposeUpdateManyWithoutOrganisationNestedInput
    policies?: PolicyUpdateManyWithoutOrganisationNestedInput
    notices?: NoticeUpdateManyWithoutOrganisationNestedInput
  }

  export type OrganisationUncheckedUpdateWithoutWebsitesInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    secretKeyHash?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    purposes?: PurposeUncheckedUpdateManyWithoutOrganisationNestedInput
    policies?: PolicyUncheckedUpdateManyWithoutOrganisationNestedInput
    notices?: NoticeUncheckedUpdateManyWithoutOrganisationNestedInput
  }

  export type SessionUpsertWithWhereUniqueWithoutWebsiteInput = {
    where: SessionWhereUniqueInput
    update: XOR<SessionUpdateWithoutWebsiteInput, SessionUncheckedUpdateWithoutWebsiteInput>
    create: XOR<SessionCreateWithoutWebsiteInput, SessionUncheckedCreateWithoutWebsiteInput>
  }

  export type SessionUpdateWithWhereUniqueWithoutWebsiteInput = {
    where: SessionWhereUniqueInput
    data: XOR<SessionUpdateWithoutWebsiteInput, SessionUncheckedUpdateWithoutWebsiteInput>
  }

  export type SessionUpdateManyWithWhereWithoutWebsiteInput = {
    where: SessionScalarWhereInput
    data: XOR<SessionUpdateManyMutationInput, SessionUncheckedUpdateManyWithoutWebsiteInput>
  }

  export type SessionScalarWhereInput = {
    AND?: SessionScalarWhereInput | SessionScalarWhereInput[]
    OR?: SessionScalarWhereInput[]
    NOT?: SessionScalarWhereInput | SessionScalarWhereInput[]
    id?: StringFilter<"Session"> | string
    siteId?: StringFilter<"Session"> | string
    startedAt?: DateTimeFilter<"Session"> | Date | string
    lastActivity?: DateTimeFilter<"Session"> | Date | string
  }

  export type EventUpsertWithWhereUniqueWithoutWebsiteInput = {
    where: EventWhereUniqueInput
    update: XOR<EventUpdateWithoutWebsiteInput, EventUncheckedUpdateWithoutWebsiteInput>
    create: XOR<EventCreateWithoutWebsiteInput, EventUncheckedCreateWithoutWebsiteInput>
  }

  export type EventUpdateWithWhereUniqueWithoutWebsiteInput = {
    where: EventWhereUniqueInput
    data: XOR<EventUpdateWithoutWebsiteInput, EventUncheckedUpdateWithoutWebsiteInput>
  }

  export type EventUpdateManyWithWhereWithoutWebsiteInput = {
    where: EventScalarWhereInput
    data: XOR<EventUpdateManyMutationInput, EventUncheckedUpdateManyWithoutWebsiteInput>
  }

  export type EventScalarWhereInput = {
    AND?: EventScalarWhereInput | EventScalarWhereInput[]
    OR?: EventScalarWhereInput[]
    NOT?: EventScalarWhereInput | EventScalarWhereInput[]
    id?: StringFilter<"Event"> | string
    eventId?: StringFilter<"Event"> | string
    siteId?: StringFilter<"Event"> | string
    sessionId?: StringFilter<"Event"> | string
    eventType?: StringFilter<"Event"> | string
    name?: StringNullableFilter<"Event"> | string | null
    eventTime?: DateTimeFilter<"Event"> | Date | string
    pageUrl?: StringFilter<"Event"> | string
    pageTitle?: StringFilter<"Event"> | string
    referrer?: StringNullableFilter<"Event"> | string | null
    deviceType?: StringFilter<"Event"> | string
    browser?: StringFilter<"Event"> | string
    os?: StringFilter<"Event"> | string
    properties?: JsonNullableFilter<"Event">
    receivedAt?: DateTimeFilter<"Event"> | Date | string
  }

  export type PrincipalUpsertWithWhereUniqueWithoutWebsiteInput = {
    where: PrincipalWhereUniqueInput
    update: XOR<PrincipalUpdateWithoutWebsiteInput, PrincipalUncheckedUpdateWithoutWebsiteInput>
    create: XOR<PrincipalCreateWithoutWebsiteInput, PrincipalUncheckedCreateWithoutWebsiteInput>
  }

  export type PrincipalUpdateWithWhereUniqueWithoutWebsiteInput = {
    where: PrincipalWhereUniqueInput
    data: XOR<PrincipalUpdateWithoutWebsiteInput, PrincipalUncheckedUpdateWithoutWebsiteInput>
  }

  export type PrincipalUpdateManyWithWhereWithoutWebsiteInput = {
    where: PrincipalScalarWhereInput
    data: XOR<PrincipalUpdateManyMutationInput, PrincipalUncheckedUpdateManyWithoutWebsiteInput>
  }

  export type PrincipalScalarWhereInput = {
    AND?: PrincipalScalarWhereInput | PrincipalScalarWhereInput[]
    OR?: PrincipalScalarWhereInput[]
    NOT?: PrincipalScalarWhereInput | PrincipalScalarWhereInput[]
    id?: StringFilter<"Principal"> | string
    siteId?: StringFilter<"Principal"> | string
    externalId?: StringFilter<"Principal"> | string
    kind?: StringFilter<"Principal"> | string
    createdAt?: DateTimeFilter<"Principal"> | Date | string
  }

  export type ConsentRecordUpsertWithWhereUniqueWithoutWebsiteInput = {
    where: ConsentRecordWhereUniqueInput
    update: XOR<ConsentRecordUpdateWithoutWebsiteInput, ConsentRecordUncheckedUpdateWithoutWebsiteInput>
    create: XOR<ConsentRecordCreateWithoutWebsiteInput, ConsentRecordUncheckedCreateWithoutWebsiteInput>
  }

  export type ConsentRecordUpdateWithWhereUniqueWithoutWebsiteInput = {
    where: ConsentRecordWhereUniqueInput
    data: XOR<ConsentRecordUpdateWithoutWebsiteInput, ConsentRecordUncheckedUpdateWithoutWebsiteInput>
  }

  export type ConsentRecordUpdateManyWithWhereWithoutWebsiteInput = {
    where: ConsentRecordScalarWhereInput
    data: XOR<ConsentRecordUpdateManyMutationInput, ConsentRecordUncheckedUpdateManyWithoutWebsiteInput>
  }

  export type ConsentRecordScalarWhereInput = {
    AND?: ConsentRecordScalarWhereInput | ConsentRecordScalarWhereInput[]
    OR?: ConsentRecordScalarWhereInput[]
    NOT?: ConsentRecordScalarWhereInput | ConsentRecordScalarWhereInput[]
    id?: StringFilter<"ConsentRecord"> | string
    organisationId?: StringFilter<"ConsentRecord"> | string
    siteId?: StringFilter<"ConsentRecord"> | string
    principalId?: StringFilter<"ConsentRecord"> | string
    purposeId?: StringFilter<"ConsentRecord"> | string
    noticeId?: StringNullableFilter<"ConsentRecord"> | string | null
    policyVersionId?: StringNullableFilter<"ConsentRecord"> | string | null
    status?: StringFilter<"ConsentRecord"> | string
    source?: StringFilter<"ConsentRecord"> | string
    decidedAt?: DateTimeFilter<"ConsentRecord"> | Date | string
    recordedAt?: DateTimeFilter<"ConsentRecord"> | Date | string
    metadata?: JsonNullableFilter<"ConsentRecord">
  }

  export type WebsiteCreateWithoutSessionsInput = {
    id?: string
    name: string
    domain: string
    publicKey: string
    isActive?: boolean
    createdAt?: Date | string
    organisation: OrganisationCreateNestedOneWithoutWebsitesInput
    events?: EventCreateNestedManyWithoutWebsiteInput
    principals?: PrincipalCreateNestedManyWithoutWebsiteInput
    consentRecords?: ConsentRecordCreateNestedManyWithoutWebsiteInput
  }

  export type WebsiteUncheckedCreateWithoutSessionsInput = {
    id?: string
    organisationId: string
    name: string
    domain: string
    publicKey: string
    isActive?: boolean
    createdAt?: Date | string
    events?: EventUncheckedCreateNestedManyWithoutWebsiteInput
    principals?: PrincipalUncheckedCreateNestedManyWithoutWebsiteInput
    consentRecords?: ConsentRecordUncheckedCreateNestedManyWithoutWebsiteInput
  }

  export type WebsiteCreateOrConnectWithoutSessionsInput = {
    where: WebsiteWhereUniqueInput
    create: XOR<WebsiteCreateWithoutSessionsInput, WebsiteUncheckedCreateWithoutSessionsInput>
  }

  export type EventCreateWithoutSessionInput = {
    id?: string
    eventId: string
    eventType: string
    name?: string | null
    eventTime: Date | string
    pageUrl: string
    pageTitle: string
    referrer?: string | null
    deviceType: string
    browser: string
    os: string
    properties?: NullableJsonNullValueInput | InputJsonValue
    receivedAt?: Date | string
    website: WebsiteCreateNestedOneWithoutEventsInput
  }

  export type EventUncheckedCreateWithoutSessionInput = {
    id?: string
    eventId: string
    eventType: string
    name?: string | null
    eventTime: Date | string
    pageUrl: string
    pageTitle: string
    referrer?: string | null
    deviceType: string
    browser: string
    os: string
    properties?: NullableJsonNullValueInput | InputJsonValue
    receivedAt?: Date | string
  }

  export type EventCreateOrConnectWithoutSessionInput = {
    where: EventWhereUniqueInput
    create: XOR<EventCreateWithoutSessionInput, EventUncheckedCreateWithoutSessionInput>
  }

  export type EventCreateManySessionInputEnvelope = {
    data: EventCreateManySessionInput | EventCreateManySessionInput[]
    skipDuplicates?: boolean
  }

  export type WebsiteUpsertWithoutSessionsInput = {
    update: XOR<WebsiteUpdateWithoutSessionsInput, WebsiteUncheckedUpdateWithoutSessionsInput>
    create: XOR<WebsiteCreateWithoutSessionsInput, WebsiteUncheckedCreateWithoutSessionsInput>
    where?: WebsiteWhereInput
  }

  export type WebsiteUpdateToOneWithWhereWithoutSessionsInput = {
    where?: WebsiteWhereInput
    data: XOR<WebsiteUpdateWithoutSessionsInput, WebsiteUncheckedUpdateWithoutSessionsInput>
  }

  export type WebsiteUpdateWithoutSessionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    domain?: StringFieldUpdateOperationsInput | string
    publicKey?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    organisation?: OrganisationUpdateOneRequiredWithoutWebsitesNestedInput
    events?: EventUpdateManyWithoutWebsiteNestedInput
    principals?: PrincipalUpdateManyWithoutWebsiteNestedInput
    consentRecords?: ConsentRecordUpdateManyWithoutWebsiteNestedInput
  }

  export type WebsiteUncheckedUpdateWithoutSessionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    organisationId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    domain?: StringFieldUpdateOperationsInput | string
    publicKey?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    events?: EventUncheckedUpdateManyWithoutWebsiteNestedInput
    principals?: PrincipalUncheckedUpdateManyWithoutWebsiteNestedInput
    consentRecords?: ConsentRecordUncheckedUpdateManyWithoutWebsiteNestedInput
  }

  export type EventUpsertWithWhereUniqueWithoutSessionInput = {
    where: EventWhereUniqueInput
    update: XOR<EventUpdateWithoutSessionInput, EventUncheckedUpdateWithoutSessionInput>
    create: XOR<EventCreateWithoutSessionInput, EventUncheckedCreateWithoutSessionInput>
  }

  export type EventUpdateWithWhereUniqueWithoutSessionInput = {
    where: EventWhereUniqueInput
    data: XOR<EventUpdateWithoutSessionInput, EventUncheckedUpdateWithoutSessionInput>
  }

  export type EventUpdateManyWithWhereWithoutSessionInput = {
    where: EventScalarWhereInput
    data: XOR<EventUpdateManyMutationInput, EventUncheckedUpdateManyWithoutSessionInput>
  }

  export type WebsiteCreateWithoutEventsInput = {
    id?: string
    name: string
    domain: string
    publicKey: string
    isActive?: boolean
    createdAt?: Date | string
    organisation: OrganisationCreateNestedOneWithoutWebsitesInput
    sessions?: SessionCreateNestedManyWithoutWebsiteInput
    principals?: PrincipalCreateNestedManyWithoutWebsiteInput
    consentRecords?: ConsentRecordCreateNestedManyWithoutWebsiteInput
  }

  export type WebsiteUncheckedCreateWithoutEventsInput = {
    id?: string
    organisationId: string
    name: string
    domain: string
    publicKey: string
    isActive?: boolean
    createdAt?: Date | string
    sessions?: SessionUncheckedCreateNestedManyWithoutWebsiteInput
    principals?: PrincipalUncheckedCreateNestedManyWithoutWebsiteInput
    consentRecords?: ConsentRecordUncheckedCreateNestedManyWithoutWebsiteInput
  }

  export type WebsiteCreateOrConnectWithoutEventsInput = {
    where: WebsiteWhereUniqueInput
    create: XOR<WebsiteCreateWithoutEventsInput, WebsiteUncheckedCreateWithoutEventsInput>
  }

  export type SessionCreateWithoutEventsInput = {
    id?: string
    startedAt?: Date | string
    lastActivity: Date | string
    website: WebsiteCreateNestedOneWithoutSessionsInput
  }

  export type SessionUncheckedCreateWithoutEventsInput = {
    id?: string
    siteId: string
    startedAt?: Date | string
    lastActivity: Date | string
  }

  export type SessionCreateOrConnectWithoutEventsInput = {
    where: SessionWhereUniqueInput
    create: XOR<SessionCreateWithoutEventsInput, SessionUncheckedCreateWithoutEventsInput>
  }

  export type WebsiteUpsertWithoutEventsInput = {
    update: XOR<WebsiteUpdateWithoutEventsInput, WebsiteUncheckedUpdateWithoutEventsInput>
    create: XOR<WebsiteCreateWithoutEventsInput, WebsiteUncheckedCreateWithoutEventsInput>
    where?: WebsiteWhereInput
  }

  export type WebsiteUpdateToOneWithWhereWithoutEventsInput = {
    where?: WebsiteWhereInput
    data: XOR<WebsiteUpdateWithoutEventsInput, WebsiteUncheckedUpdateWithoutEventsInput>
  }

  export type WebsiteUpdateWithoutEventsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    domain?: StringFieldUpdateOperationsInput | string
    publicKey?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    organisation?: OrganisationUpdateOneRequiredWithoutWebsitesNestedInput
    sessions?: SessionUpdateManyWithoutWebsiteNestedInput
    principals?: PrincipalUpdateManyWithoutWebsiteNestedInput
    consentRecords?: ConsentRecordUpdateManyWithoutWebsiteNestedInput
  }

  export type WebsiteUncheckedUpdateWithoutEventsInput = {
    id?: StringFieldUpdateOperationsInput | string
    organisationId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    domain?: StringFieldUpdateOperationsInput | string
    publicKey?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sessions?: SessionUncheckedUpdateManyWithoutWebsiteNestedInput
    principals?: PrincipalUncheckedUpdateManyWithoutWebsiteNestedInput
    consentRecords?: ConsentRecordUncheckedUpdateManyWithoutWebsiteNestedInput
  }

  export type SessionUpsertWithoutEventsInput = {
    update: XOR<SessionUpdateWithoutEventsInput, SessionUncheckedUpdateWithoutEventsInput>
    create: XOR<SessionCreateWithoutEventsInput, SessionUncheckedCreateWithoutEventsInput>
    where?: SessionWhereInput
  }

  export type SessionUpdateToOneWithWhereWithoutEventsInput = {
    where?: SessionWhereInput
    data: XOR<SessionUpdateWithoutEventsInput, SessionUncheckedUpdateWithoutEventsInput>
  }

  export type SessionUpdateWithoutEventsInput = {
    id?: StringFieldUpdateOperationsInput | string
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    lastActivity?: DateTimeFieldUpdateOperationsInput | Date | string
    website?: WebsiteUpdateOneRequiredWithoutSessionsNestedInput
  }

  export type SessionUncheckedUpdateWithoutEventsInput = {
    id?: StringFieldUpdateOperationsInput | string
    siteId?: StringFieldUpdateOperationsInput | string
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    lastActivity?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type WebsiteCreateWithoutPrincipalsInput = {
    id?: string
    name: string
    domain: string
    publicKey: string
    isActive?: boolean
    createdAt?: Date | string
    organisation: OrganisationCreateNestedOneWithoutWebsitesInput
    sessions?: SessionCreateNestedManyWithoutWebsiteInput
    events?: EventCreateNestedManyWithoutWebsiteInput
    consentRecords?: ConsentRecordCreateNestedManyWithoutWebsiteInput
  }

  export type WebsiteUncheckedCreateWithoutPrincipalsInput = {
    id?: string
    organisationId: string
    name: string
    domain: string
    publicKey: string
    isActive?: boolean
    createdAt?: Date | string
    sessions?: SessionUncheckedCreateNestedManyWithoutWebsiteInput
    events?: EventUncheckedCreateNestedManyWithoutWebsiteInput
    consentRecords?: ConsentRecordUncheckedCreateNestedManyWithoutWebsiteInput
  }

  export type WebsiteCreateOrConnectWithoutPrincipalsInput = {
    where: WebsiteWhereUniqueInput
    create: XOR<WebsiteCreateWithoutPrincipalsInput, WebsiteUncheckedCreateWithoutPrincipalsInput>
  }

  export type ConsentRecordCreateWithoutPrincipalInput = {
    id?: string
    status: string
    source?: string
    decidedAt: Date | string
    recordedAt?: Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
    website: WebsiteCreateNestedOneWithoutConsentRecordsInput
    purpose: PurposeCreateNestedOneWithoutConsentRecordsInput
    notice?: NoticeCreateNestedOneWithoutConsentRecordsInput
    policyVersion?: PolicyVersionCreateNestedOneWithoutConsentRecordsInput
  }

  export type ConsentRecordUncheckedCreateWithoutPrincipalInput = {
    id?: string
    organisationId: string
    purposeId: string
    noticeId?: string | null
    policyVersionId?: string | null
    status: string
    source?: string
    decidedAt: Date | string
    recordedAt?: Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
  }

  export type ConsentRecordCreateOrConnectWithoutPrincipalInput = {
    where: ConsentRecordWhereUniqueInput
    create: XOR<ConsentRecordCreateWithoutPrincipalInput, ConsentRecordUncheckedCreateWithoutPrincipalInput>
  }

  export type ConsentRecordCreateManyPrincipalInputEnvelope = {
    data: ConsentRecordCreateManyPrincipalInput | ConsentRecordCreateManyPrincipalInput[]
    skipDuplicates?: boolean
  }

  export type WebsiteUpsertWithoutPrincipalsInput = {
    update: XOR<WebsiteUpdateWithoutPrincipalsInput, WebsiteUncheckedUpdateWithoutPrincipalsInput>
    create: XOR<WebsiteCreateWithoutPrincipalsInput, WebsiteUncheckedCreateWithoutPrincipalsInput>
    where?: WebsiteWhereInput
  }

  export type WebsiteUpdateToOneWithWhereWithoutPrincipalsInput = {
    where?: WebsiteWhereInput
    data: XOR<WebsiteUpdateWithoutPrincipalsInput, WebsiteUncheckedUpdateWithoutPrincipalsInput>
  }

  export type WebsiteUpdateWithoutPrincipalsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    domain?: StringFieldUpdateOperationsInput | string
    publicKey?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    organisation?: OrganisationUpdateOneRequiredWithoutWebsitesNestedInput
    sessions?: SessionUpdateManyWithoutWebsiteNestedInput
    events?: EventUpdateManyWithoutWebsiteNestedInput
    consentRecords?: ConsentRecordUpdateManyWithoutWebsiteNestedInput
  }

  export type WebsiteUncheckedUpdateWithoutPrincipalsInput = {
    id?: StringFieldUpdateOperationsInput | string
    organisationId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    domain?: StringFieldUpdateOperationsInput | string
    publicKey?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sessions?: SessionUncheckedUpdateManyWithoutWebsiteNestedInput
    events?: EventUncheckedUpdateManyWithoutWebsiteNestedInput
    consentRecords?: ConsentRecordUncheckedUpdateManyWithoutWebsiteNestedInput
  }

  export type ConsentRecordUpsertWithWhereUniqueWithoutPrincipalInput = {
    where: ConsentRecordWhereUniqueInput
    update: XOR<ConsentRecordUpdateWithoutPrincipalInput, ConsentRecordUncheckedUpdateWithoutPrincipalInput>
    create: XOR<ConsentRecordCreateWithoutPrincipalInput, ConsentRecordUncheckedCreateWithoutPrincipalInput>
  }

  export type ConsentRecordUpdateWithWhereUniqueWithoutPrincipalInput = {
    where: ConsentRecordWhereUniqueInput
    data: XOR<ConsentRecordUpdateWithoutPrincipalInput, ConsentRecordUncheckedUpdateWithoutPrincipalInput>
  }

  export type ConsentRecordUpdateManyWithWhereWithoutPrincipalInput = {
    where: ConsentRecordScalarWhereInput
    data: XOR<ConsentRecordUpdateManyMutationInput, ConsentRecordUncheckedUpdateManyWithoutPrincipalInput>
  }

  export type OrganisationCreateWithoutPurposesInput = {
    id?: string
    name: string
    slug: string
    secretKeyHash: string
    createdAt?: Date | string
    websites?: WebsiteCreateNestedManyWithoutOrganisationInput
    policies?: PolicyCreateNestedManyWithoutOrganisationInput
    notices?: NoticeCreateNestedManyWithoutOrganisationInput
  }

  export type OrganisationUncheckedCreateWithoutPurposesInput = {
    id?: string
    name: string
    slug: string
    secretKeyHash: string
    createdAt?: Date | string
    websites?: WebsiteUncheckedCreateNestedManyWithoutOrganisationInput
    policies?: PolicyUncheckedCreateNestedManyWithoutOrganisationInput
    notices?: NoticeUncheckedCreateNestedManyWithoutOrganisationInput
  }

  export type OrganisationCreateOrConnectWithoutPurposesInput = {
    where: OrganisationWhereUniqueInput
    create: XOR<OrganisationCreateWithoutPurposesInput, OrganisationUncheckedCreateWithoutPurposesInput>
  }

  export type NoticePurposeCreateWithoutPurposeInput = {
    notice: NoticeCreateNestedOneWithoutPurposesInput
  }

  export type NoticePurposeUncheckedCreateWithoutPurposeInput = {
    noticeId: string
  }

  export type NoticePurposeCreateOrConnectWithoutPurposeInput = {
    where: NoticePurposeWhereUniqueInput
    create: XOR<NoticePurposeCreateWithoutPurposeInput, NoticePurposeUncheckedCreateWithoutPurposeInput>
  }

  export type NoticePurposeCreateManyPurposeInputEnvelope = {
    data: NoticePurposeCreateManyPurposeInput | NoticePurposeCreateManyPurposeInput[]
    skipDuplicates?: boolean
  }

  export type ConsentRecordCreateWithoutPurposeInput = {
    id?: string
    status: string
    source?: string
    decidedAt: Date | string
    recordedAt?: Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
    website: WebsiteCreateNestedOneWithoutConsentRecordsInput
    principal: PrincipalCreateNestedOneWithoutConsentRecordsInput
    notice?: NoticeCreateNestedOneWithoutConsentRecordsInput
    policyVersion?: PolicyVersionCreateNestedOneWithoutConsentRecordsInput
  }

  export type ConsentRecordUncheckedCreateWithoutPurposeInput = {
    id?: string
    siteId: string
    principalId: string
    noticeId?: string | null
    policyVersionId?: string | null
    status: string
    source?: string
    decidedAt: Date | string
    recordedAt?: Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
  }

  export type ConsentRecordCreateOrConnectWithoutPurposeInput = {
    where: ConsentRecordWhereUniqueInput
    create: XOR<ConsentRecordCreateWithoutPurposeInput, ConsentRecordUncheckedCreateWithoutPurposeInput>
  }

  export type ConsentRecordCreateManyPurposeInputEnvelope = {
    data: ConsentRecordCreateManyPurposeInput | ConsentRecordCreateManyPurposeInput[]
    skipDuplicates?: boolean
  }

  export type OrganisationUpsertWithoutPurposesInput = {
    update: XOR<OrganisationUpdateWithoutPurposesInput, OrganisationUncheckedUpdateWithoutPurposesInput>
    create: XOR<OrganisationCreateWithoutPurposesInput, OrganisationUncheckedCreateWithoutPurposesInput>
    where?: OrganisationWhereInput
  }

  export type OrganisationUpdateToOneWithWhereWithoutPurposesInput = {
    where?: OrganisationWhereInput
    data: XOR<OrganisationUpdateWithoutPurposesInput, OrganisationUncheckedUpdateWithoutPurposesInput>
  }

  export type OrganisationUpdateWithoutPurposesInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    secretKeyHash?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    websites?: WebsiteUpdateManyWithoutOrganisationNestedInput
    policies?: PolicyUpdateManyWithoutOrganisationNestedInput
    notices?: NoticeUpdateManyWithoutOrganisationNestedInput
  }

  export type OrganisationUncheckedUpdateWithoutPurposesInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    secretKeyHash?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    websites?: WebsiteUncheckedUpdateManyWithoutOrganisationNestedInput
    policies?: PolicyUncheckedUpdateManyWithoutOrganisationNestedInput
    notices?: NoticeUncheckedUpdateManyWithoutOrganisationNestedInput
  }

  export type NoticePurposeUpsertWithWhereUniqueWithoutPurposeInput = {
    where: NoticePurposeWhereUniqueInput
    update: XOR<NoticePurposeUpdateWithoutPurposeInput, NoticePurposeUncheckedUpdateWithoutPurposeInput>
    create: XOR<NoticePurposeCreateWithoutPurposeInput, NoticePurposeUncheckedCreateWithoutPurposeInput>
  }

  export type NoticePurposeUpdateWithWhereUniqueWithoutPurposeInput = {
    where: NoticePurposeWhereUniqueInput
    data: XOR<NoticePurposeUpdateWithoutPurposeInput, NoticePurposeUncheckedUpdateWithoutPurposeInput>
  }

  export type NoticePurposeUpdateManyWithWhereWithoutPurposeInput = {
    where: NoticePurposeScalarWhereInput
    data: XOR<NoticePurposeUpdateManyMutationInput, NoticePurposeUncheckedUpdateManyWithoutPurposeInput>
  }

  export type NoticePurposeScalarWhereInput = {
    AND?: NoticePurposeScalarWhereInput | NoticePurposeScalarWhereInput[]
    OR?: NoticePurposeScalarWhereInput[]
    NOT?: NoticePurposeScalarWhereInput | NoticePurposeScalarWhereInput[]
    noticeId?: StringFilter<"NoticePurpose"> | string
    purposeId?: StringFilter<"NoticePurpose"> | string
  }

  export type ConsentRecordUpsertWithWhereUniqueWithoutPurposeInput = {
    where: ConsentRecordWhereUniqueInput
    update: XOR<ConsentRecordUpdateWithoutPurposeInput, ConsentRecordUncheckedUpdateWithoutPurposeInput>
    create: XOR<ConsentRecordCreateWithoutPurposeInput, ConsentRecordUncheckedCreateWithoutPurposeInput>
  }

  export type ConsentRecordUpdateWithWhereUniqueWithoutPurposeInput = {
    where: ConsentRecordWhereUniqueInput
    data: XOR<ConsentRecordUpdateWithoutPurposeInput, ConsentRecordUncheckedUpdateWithoutPurposeInput>
  }

  export type ConsentRecordUpdateManyWithWhereWithoutPurposeInput = {
    where: ConsentRecordScalarWhereInput
    data: XOR<ConsentRecordUpdateManyMutationInput, ConsentRecordUncheckedUpdateManyWithoutPurposeInput>
  }

  export type OrganisationCreateWithoutPoliciesInput = {
    id?: string
    name: string
    slug: string
    secretKeyHash: string
    createdAt?: Date | string
    websites?: WebsiteCreateNestedManyWithoutOrganisationInput
    purposes?: PurposeCreateNestedManyWithoutOrganisationInput
    notices?: NoticeCreateNestedManyWithoutOrganisationInput
  }

  export type OrganisationUncheckedCreateWithoutPoliciesInput = {
    id?: string
    name: string
    slug: string
    secretKeyHash: string
    createdAt?: Date | string
    websites?: WebsiteUncheckedCreateNestedManyWithoutOrganisationInput
    purposes?: PurposeUncheckedCreateNestedManyWithoutOrganisationInput
    notices?: NoticeUncheckedCreateNestedManyWithoutOrganisationInput
  }

  export type OrganisationCreateOrConnectWithoutPoliciesInput = {
    where: OrganisationWhereUniqueInput
    create: XOR<OrganisationCreateWithoutPoliciesInput, OrganisationUncheckedCreateWithoutPoliciesInput>
  }

  export type PolicyVersionCreateWithoutPolicyInput = {
    id?: string
    version: string
    documentUrl?: string | null
    contentHash?: string | null
    publishedAt?: Date | string
    notices?: NoticeCreateNestedManyWithoutPolicyVersionInput
    consentRecords?: ConsentRecordCreateNestedManyWithoutPolicyVersionInput
  }

  export type PolicyVersionUncheckedCreateWithoutPolicyInput = {
    id?: string
    version: string
    documentUrl?: string | null
    contentHash?: string | null
    publishedAt?: Date | string
    notices?: NoticeUncheckedCreateNestedManyWithoutPolicyVersionInput
    consentRecords?: ConsentRecordUncheckedCreateNestedManyWithoutPolicyVersionInput
  }

  export type PolicyVersionCreateOrConnectWithoutPolicyInput = {
    where: PolicyVersionWhereUniqueInput
    create: XOR<PolicyVersionCreateWithoutPolicyInput, PolicyVersionUncheckedCreateWithoutPolicyInput>
  }

  export type PolicyVersionCreateManyPolicyInputEnvelope = {
    data: PolicyVersionCreateManyPolicyInput | PolicyVersionCreateManyPolicyInput[]
    skipDuplicates?: boolean
  }

  export type OrganisationUpsertWithoutPoliciesInput = {
    update: XOR<OrganisationUpdateWithoutPoliciesInput, OrganisationUncheckedUpdateWithoutPoliciesInput>
    create: XOR<OrganisationCreateWithoutPoliciesInput, OrganisationUncheckedCreateWithoutPoliciesInput>
    where?: OrganisationWhereInput
  }

  export type OrganisationUpdateToOneWithWhereWithoutPoliciesInput = {
    where?: OrganisationWhereInput
    data: XOR<OrganisationUpdateWithoutPoliciesInput, OrganisationUncheckedUpdateWithoutPoliciesInput>
  }

  export type OrganisationUpdateWithoutPoliciesInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    secretKeyHash?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    websites?: WebsiteUpdateManyWithoutOrganisationNestedInput
    purposes?: PurposeUpdateManyWithoutOrganisationNestedInput
    notices?: NoticeUpdateManyWithoutOrganisationNestedInput
  }

  export type OrganisationUncheckedUpdateWithoutPoliciesInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    secretKeyHash?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    websites?: WebsiteUncheckedUpdateManyWithoutOrganisationNestedInput
    purposes?: PurposeUncheckedUpdateManyWithoutOrganisationNestedInput
    notices?: NoticeUncheckedUpdateManyWithoutOrganisationNestedInput
  }

  export type PolicyVersionUpsertWithWhereUniqueWithoutPolicyInput = {
    where: PolicyVersionWhereUniqueInput
    update: XOR<PolicyVersionUpdateWithoutPolicyInput, PolicyVersionUncheckedUpdateWithoutPolicyInput>
    create: XOR<PolicyVersionCreateWithoutPolicyInput, PolicyVersionUncheckedCreateWithoutPolicyInput>
  }

  export type PolicyVersionUpdateWithWhereUniqueWithoutPolicyInput = {
    where: PolicyVersionWhereUniqueInput
    data: XOR<PolicyVersionUpdateWithoutPolicyInput, PolicyVersionUncheckedUpdateWithoutPolicyInput>
  }

  export type PolicyVersionUpdateManyWithWhereWithoutPolicyInput = {
    where: PolicyVersionScalarWhereInput
    data: XOR<PolicyVersionUpdateManyMutationInput, PolicyVersionUncheckedUpdateManyWithoutPolicyInput>
  }

  export type PolicyVersionScalarWhereInput = {
    AND?: PolicyVersionScalarWhereInput | PolicyVersionScalarWhereInput[]
    OR?: PolicyVersionScalarWhereInput[]
    NOT?: PolicyVersionScalarWhereInput | PolicyVersionScalarWhereInput[]
    id?: StringFilter<"PolicyVersion"> | string
    organisationId?: StringFilter<"PolicyVersion"> | string
    policyId?: StringFilter<"PolicyVersion"> | string
    version?: StringFilter<"PolicyVersion"> | string
    documentUrl?: StringNullableFilter<"PolicyVersion"> | string | null
    contentHash?: StringNullableFilter<"PolicyVersion"> | string | null
    publishedAt?: DateTimeFilter<"PolicyVersion"> | Date | string
  }

  export type PolicyCreateWithoutVersionsInput = {
    id?: string
    code: string
    name: string
    createdAt?: Date | string
    organisation: OrganisationCreateNestedOneWithoutPoliciesInput
  }

  export type PolicyUncheckedCreateWithoutVersionsInput = {
    id?: string
    organisationId: string
    code: string
    name: string
    createdAt?: Date | string
  }

  export type PolicyCreateOrConnectWithoutVersionsInput = {
    where: PolicyWhereUniqueInput
    create: XOR<PolicyCreateWithoutVersionsInput, PolicyUncheckedCreateWithoutVersionsInput>
  }

  export type NoticeCreateWithoutPolicyVersionInput = {
    id?: string
    version: string
    locale?: string
    publishedAt?: Date | string
    organisation: OrganisationCreateNestedOneWithoutNoticesInput
    purposes?: NoticePurposeCreateNestedManyWithoutNoticeInput
    consentRecords?: ConsentRecordCreateNestedManyWithoutNoticeInput
  }

  export type NoticeUncheckedCreateWithoutPolicyVersionInput = {
    id?: string
    version: string
    locale?: string
    publishedAt?: Date | string
    purposes?: NoticePurposeUncheckedCreateNestedManyWithoutNoticeInput
    consentRecords?: ConsentRecordUncheckedCreateNestedManyWithoutNoticeInput
  }

  export type NoticeCreateOrConnectWithoutPolicyVersionInput = {
    where: NoticeWhereUniqueInput
    create: XOR<NoticeCreateWithoutPolicyVersionInput, NoticeUncheckedCreateWithoutPolicyVersionInput>
  }

  export type NoticeCreateManyPolicyVersionInputEnvelope = {
    data: NoticeCreateManyPolicyVersionInput | NoticeCreateManyPolicyVersionInput[]
    skipDuplicates?: boolean
  }

  export type ConsentRecordCreateWithoutPolicyVersionInput = {
    id?: string
    status: string
    source?: string
    decidedAt: Date | string
    recordedAt?: Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
    website: WebsiteCreateNestedOneWithoutConsentRecordsInput
    principal: PrincipalCreateNestedOneWithoutConsentRecordsInput
    purpose: PurposeCreateNestedOneWithoutConsentRecordsInput
    notice?: NoticeCreateNestedOneWithoutConsentRecordsInput
  }

  export type ConsentRecordUncheckedCreateWithoutPolicyVersionInput = {
    id?: string
    siteId: string
    principalId: string
    purposeId: string
    noticeId?: string | null
    status: string
    source?: string
    decidedAt: Date | string
    recordedAt?: Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
  }

  export type ConsentRecordCreateOrConnectWithoutPolicyVersionInput = {
    where: ConsentRecordWhereUniqueInput
    create: XOR<ConsentRecordCreateWithoutPolicyVersionInput, ConsentRecordUncheckedCreateWithoutPolicyVersionInput>
  }

  export type ConsentRecordCreateManyPolicyVersionInputEnvelope = {
    data: ConsentRecordCreateManyPolicyVersionInput | ConsentRecordCreateManyPolicyVersionInput[]
    skipDuplicates?: boolean
  }

  export type PolicyUpsertWithoutVersionsInput = {
    update: XOR<PolicyUpdateWithoutVersionsInput, PolicyUncheckedUpdateWithoutVersionsInput>
    create: XOR<PolicyCreateWithoutVersionsInput, PolicyUncheckedCreateWithoutVersionsInput>
    where?: PolicyWhereInput
  }

  export type PolicyUpdateToOneWithWhereWithoutVersionsInput = {
    where?: PolicyWhereInput
    data: XOR<PolicyUpdateWithoutVersionsInput, PolicyUncheckedUpdateWithoutVersionsInput>
  }

  export type PolicyUpdateWithoutVersionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    organisation?: OrganisationUpdateOneRequiredWithoutPoliciesNestedInput
  }

  export type PolicyUncheckedUpdateWithoutVersionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    organisationId?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type NoticeUpsertWithWhereUniqueWithoutPolicyVersionInput = {
    where: NoticeWhereUniqueInput
    update: XOR<NoticeUpdateWithoutPolicyVersionInput, NoticeUncheckedUpdateWithoutPolicyVersionInput>
    create: XOR<NoticeCreateWithoutPolicyVersionInput, NoticeUncheckedCreateWithoutPolicyVersionInput>
  }

  export type NoticeUpdateWithWhereUniqueWithoutPolicyVersionInput = {
    where: NoticeWhereUniqueInput
    data: XOR<NoticeUpdateWithoutPolicyVersionInput, NoticeUncheckedUpdateWithoutPolicyVersionInput>
  }

  export type NoticeUpdateManyWithWhereWithoutPolicyVersionInput = {
    where: NoticeScalarWhereInput
    data: XOR<NoticeUpdateManyMutationInput, NoticeUncheckedUpdateManyWithoutPolicyVersionInput>
  }

  export type ConsentRecordUpsertWithWhereUniqueWithoutPolicyVersionInput = {
    where: ConsentRecordWhereUniqueInput
    update: XOR<ConsentRecordUpdateWithoutPolicyVersionInput, ConsentRecordUncheckedUpdateWithoutPolicyVersionInput>
    create: XOR<ConsentRecordCreateWithoutPolicyVersionInput, ConsentRecordUncheckedCreateWithoutPolicyVersionInput>
  }

  export type ConsentRecordUpdateWithWhereUniqueWithoutPolicyVersionInput = {
    where: ConsentRecordWhereUniqueInput
    data: XOR<ConsentRecordUpdateWithoutPolicyVersionInput, ConsentRecordUncheckedUpdateWithoutPolicyVersionInput>
  }

  export type ConsentRecordUpdateManyWithWhereWithoutPolicyVersionInput = {
    where: ConsentRecordScalarWhereInput
    data: XOR<ConsentRecordUpdateManyMutationInput, ConsentRecordUncheckedUpdateManyWithoutPolicyVersionInput>
  }

  export type OrganisationCreateWithoutNoticesInput = {
    id?: string
    name: string
    slug: string
    secretKeyHash: string
    createdAt?: Date | string
    websites?: WebsiteCreateNestedManyWithoutOrganisationInput
    purposes?: PurposeCreateNestedManyWithoutOrganisationInput
    policies?: PolicyCreateNestedManyWithoutOrganisationInput
  }

  export type OrganisationUncheckedCreateWithoutNoticesInput = {
    id?: string
    name: string
    slug: string
    secretKeyHash: string
    createdAt?: Date | string
    websites?: WebsiteUncheckedCreateNestedManyWithoutOrganisationInput
    purposes?: PurposeUncheckedCreateNestedManyWithoutOrganisationInput
    policies?: PolicyUncheckedCreateNestedManyWithoutOrganisationInput
  }

  export type OrganisationCreateOrConnectWithoutNoticesInput = {
    where: OrganisationWhereUniqueInput
    create: XOR<OrganisationCreateWithoutNoticesInput, OrganisationUncheckedCreateWithoutNoticesInput>
  }

  export type PolicyVersionCreateWithoutNoticesInput = {
    id?: string
    version: string
    documentUrl?: string | null
    contentHash?: string | null
    publishedAt?: Date | string
    policy: PolicyCreateNestedOneWithoutVersionsInput
    consentRecords?: ConsentRecordCreateNestedManyWithoutPolicyVersionInput
  }

  export type PolicyVersionUncheckedCreateWithoutNoticesInput = {
    id?: string
    organisationId: string
    policyId: string
    version: string
    documentUrl?: string | null
    contentHash?: string | null
    publishedAt?: Date | string
    consentRecords?: ConsentRecordUncheckedCreateNestedManyWithoutPolicyVersionInput
  }

  export type PolicyVersionCreateOrConnectWithoutNoticesInput = {
    where: PolicyVersionWhereUniqueInput
    create: XOR<PolicyVersionCreateWithoutNoticesInput, PolicyVersionUncheckedCreateWithoutNoticesInput>
  }

  export type NoticePurposeCreateWithoutNoticeInput = {
    purpose: PurposeCreateNestedOneWithoutNoticePurposesInput
  }

  export type NoticePurposeUncheckedCreateWithoutNoticeInput = {
    purposeId: string
  }

  export type NoticePurposeCreateOrConnectWithoutNoticeInput = {
    where: NoticePurposeWhereUniqueInput
    create: XOR<NoticePurposeCreateWithoutNoticeInput, NoticePurposeUncheckedCreateWithoutNoticeInput>
  }

  export type NoticePurposeCreateManyNoticeInputEnvelope = {
    data: NoticePurposeCreateManyNoticeInput | NoticePurposeCreateManyNoticeInput[]
    skipDuplicates?: boolean
  }

  export type ConsentRecordCreateWithoutNoticeInput = {
    id?: string
    status: string
    source?: string
    decidedAt: Date | string
    recordedAt?: Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
    website: WebsiteCreateNestedOneWithoutConsentRecordsInput
    principal: PrincipalCreateNestedOneWithoutConsentRecordsInput
    purpose: PurposeCreateNestedOneWithoutConsentRecordsInput
    policyVersion?: PolicyVersionCreateNestedOneWithoutConsentRecordsInput
  }

  export type ConsentRecordUncheckedCreateWithoutNoticeInput = {
    id?: string
    siteId: string
    principalId: string
    purposeId: string
    policyVersionId?: string | null
    status: string
    source?: string
    decidedAt: Date | string
    recordedAt?: Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
  }

  export type ConsentRecordCreateOrConnectWithoutNoticeInput = {
    where: ConsentRecordWhereUniqueInput
    create: XOR<ConsentRecordCreateWithoutNoticeInput, ConsentRecordUncheckedCreateWithoutNoticeInput>
  }

  export type ConsentRecordCreateManyNoticeInputEnvelope = {
    data: ConsentRecordCreateManyNoticeInput | ConsentRecordCreateManyNoticeInput[]
    skipDuplicates?: boolean
  }

  export type OrganisationUpsertWithoutNoticesInput = {
    update: XOR<OrganisationUpdateWithoutNoticesInput, OrganisationUncheckedUpdateWithoutNoticesInput>
    create: XOR<OrganisationCreateWithoutNoticesInput, OrganisationUncheckedCreateWithoutNoticesInput>
    where?: OrganisationWhereInput
  }

  export type OrganisationUpdateToOneWithWhereWithoutNoticesInput = {
    where?: OrganisationWhereInput
    data: XOR<OrganisationUpdateWithoutNoticesInput, OrganisationUncheckedUpdateWithoutNoticesInput>
  }

  export type OrganisationUpdateWithoutNoticesInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    secretKeyHash?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    websites?: WebsiteUpdateManyWithoutOrganisationNestedInput
    purposes?: PurposeUpdateManyWithoutOrganisationNestedInput
    policies?: PolicyUpdateManyWithoutOrganisationNestedInput
  }

  export type OrganisationUncheckedUpdateWithoutNoticesInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    secretKeyHash?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    websites?: WebsiteUncheckedUpdateManyWithoutOrganisationNestedInput
    purposes?: PurposeUncheckedUpdateManyWithoutOrganisationNestedInput
    policies?: PolicyUncheckedUpdateManyWithoutOrganisationNestedInput
  }

  export type PolicyVersionUpsertWithoutNoticesInput = {
    update: XOR<PolicyVersionUpdateWithoutNoticesInput, PolicyVersionUncheckedUpdateWithoutNoticesInput>
    create: XOR<PolicyVersionCreateWithoutNoticesInput, PolicyVersionUncheckedCreateWithoutNoticesInput>
    where?: PolicyVersionWhereInput
  }

  export type PolicyVersionUpdateToOneWithWhereWithoutNoticesInput = {
    where?: PolicyVersionWhereInput
    data: XOR<PolicyVersionUpdateWithoutNoticesInput, PolicyVersionUncheckedUpdateWithoutNoticesInput>
  }

  export type PolicyVersionUpdateWithoutNoticesInput = {
    id?: StringFieldUpdateOperationsInput | string
    version?: StringFieldUpdateOperationsInput | string
    documentUrl?: NullableStringFieldUpdateOperationsInput | string | null
    contentHash?: NullableStringFieldUpdateOperationsInput | string | null
    publishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    policy?: PolicyUpdateOneRequiredWithoutVersionsNestedInput
    consentRecords?: ConsentRecordUpdateManyWithoutPolicyVersionNestedInput
  }

  export type PolicyVersionUncheckedUpdateWithoutNoticesInput = {
    id?: StringFieldUpdateOperationsInput | string
    organisationId?: StringFieldUpdateOperationsInput | string
    policyId?: StringFieldUpdateOperationsInput | string
    version?: StringFieldUpdateOperationsInput | string
    documentUrl?: NullableStringFieldUpdateOperationsInput | string | null
    contentHash?: NullableStringFieldUpdateOperationsInput | string | null
    publishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    consentRecords?: ConsentRecordUncheckedUpdateManyWithoutPolicyVersionNestedInput
  }

  export type NoticePurposeUpsertWithWhereUniqueWithoutNoticeInput = {
    where: NoticePurposeWhereUniqueInput
    update: XOR<NoticePurposeUpdateWithoutNoticeInput, NoticePurposeUncheckedUpdateWithoutNoticeInput>
    create: XOR<NoticePurposeCreateWithoutNoticeInput, NoticePurposeUncheckedCreateWithoutNoticeInput>
  }

  export type NoticePurposeUpdateWithWhereUniqueWithoutNoticeInput = {
    where: NoticePurposeWhereUniqueInput
    data: XOR<NoticePurposeUpdateWithoutNoticeInput, NoticePurposeUncheckedUpdateWithoutNoticeInput>
  }

  export type NoticePurposeUpdateManyWithWhereWithoutNoticeInput = {
    where: NoticePurposeScalarWhereInput
    data: XOR<NoticePurposeUpdateManyMutationInput, NoticePurposeUncheckedUpdateManyWithoutNoticeInput>
  }

  export type ConsentRecordUpsertWithWhereUniqueWithoutNoticeInput = {
    where: ConsentRecordWhereUniqueInput
    update: XOR<ConsentRecordUpdateWithoutNoticeInput, ConsentRecordUncheckedUpdateWithoutNoticeInput>
    create: XOR<ConsentRecordCreateWithoutNoticeInput, ConsentRecordUncheckedCreateWithoutNoticeInput>
  }

  export type ConsentRecordUpdateWithWhereUniqueWithoutNoticeInput = {
    where: ConsentRecordWhereUniqueInput
    data: XOR<ConsentRecordUpdateWithoutNoticeInput, ConsentRecordUncheckedUpdateWithoutNoticeInput>
  }

  export type ConsentRecordUpdateManyWithWhereWithoutNoticeInput = {
    where: ConsentRecordScalarWhereInput
    data: XOR<ConsentRecordUpdateManyMutationInput, ConsentRecordUncheckedUpdateManyWithoutNoticeInput>
  }

  export type NoticeCreateWithoutPurposesInput = {
    id?: string
    version: string
    locale?: string
    publishedAt?: Date | string
    organisation: OrganisationCreateNestedOneWithoutNoticesInput
    policyVersion: PolicyVersionCreateNestedOneWithoutNoticesInput
    consentRecords?: ConsentRecordCreateNestedManyWithoutNoticeInput
  }

  export type NoticeUncheckedCreateWithoutPurposesInput = {
    id?: string
    organisationId: string
    policyVersionId: string
    version: string
    locale?: string
    publishedAt?: Date | string
    consentRecords?: ConsentRecordUncheckedCreateNestedManyWithoutNoticeInput
  }

  export type NoticeCreateOrConnectWithoutPurposesInput = {
    where: NoticeWhereUniqueInput
    create: XOR<NoticeCreateWithoutPurposesInput, NoticeUncheckedCreateWithoutPurposesInput>
  }

  export type PurposeCreateWithoutNoticePurposesInput = {
    id?: string
    code: string
    name: string
    description: string
    isActive?: boolean
    createdAt?: Date | string
    organisation: OrganisationCreateNestedOneWithoutPurposesInput
    consentRecords?: ConsentRecordCreateNestedManyWithoutPurposeInput
  }

  export type PurposeUncheckedCreateWithoutNoticePurposesInput = {
    id?: string
    organisationId: string
    code: string
    name: string
    description: string
    isActive?: boolean
    createdAt?: Date | string
    consentRecords?: ConsentRecordUncheckedCreateNestedManyWithoutPurposeInput
  }

  export type PurposeCreateOrConnectWithoutNoticePurposesInput = {
    where: PurposeWhereUniqueInput
    create: XOR<PurposeCreateWithoutNoticePurposesInput, PurposeUncheckedCreateWithoutNoticePurposesInput>
  }

  export type NoticeUpsertWithoutPurposesInput = {
    update: XOR<NoticeUpdateWithoutPurposesInput, NoticeUncheckedUpdateWithoutPurposesInput>
    create: XOR<NoticeCreateWithoutPurposesInput, NoticeUncheckedCreateWithoutPurposesInput>
    where?: NoticeWhereInput
  }

  export type NoticeUpdateToOneWithWhereWithoutPurposesInput = {
    where?: NoticeWhereInput
    data: XOR<NoticeUpdateWithoutPurposesInput, NoticeUncheckedUpdateWithoutPurposesInput>
  }

  export type NoticeUpdateWithoutPurposesInput = {
    id?: StringFieldUpdateOperationsInput | string
    version?: StringFieldUpdateOperationsInput | string
    locale?: StringFieldUpdateOperationsInput | string
    publishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    organisation?: OrganisationUpdateOneRequiredWithoutNoticesNestedInput
    policyVersion?: PolicyVersionUpdateOneRequiredWithoutNoticesNestedInput
    consentRecords?: ConsentRecordUpdateManyWithoutNoticeNestedInput
  }

  export type NoticeUncheckedUpdateWithoutPurposesInput = {
    id?: StringFieldUpdateOperationsInput | string
    organisationId?: StringFieldUpdateOperationsInput | string
    policyVersionId?: StringFieldUpdateOperationsInput | string
    version?: StringFieldUpdateOperationsInput | string
    locale?: StringFieldUpdateOperationsInput | string
    publishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    consentRecords?: ConsentRecordUncheckedUpdateManyWithoutNoticeNestedInput
  }

  export type PurposeUpsertWithoutNoticePurposesInput = {
    update: XOR<PurposeUpdateWithoutNoticePurposesInput, PurposeUncheckedUpdateWithoutNoticePurposesInput>
    create: XOR<PurposeCreateWithoutNoticePurposesInput, PurposeUncheckedCreateWithoutNoticePurposesInput>
    where?: PurposeWhereInput
  }

  export type PurposeUpdateToOneWithWhereWithoutNoticePurposesInput = {
    where?: PurposeWhereInput
    data: XOR<PurposeUpdateWithoutNoticePurposesInput, PurposeUncheckedUpdateWithoutNoticePurposesInput>
  }

  export type PurposeUpdateWithoutNoticePurposesInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    organisation?: OrganisationUpdateOneRequiredWithoutPurposesNestedInput
    consentRecords?: ConsentRecordUpdateManyWithoutPurposeNestedInput
  }

  export type PurposeUncheckedUpdateWithoutNoticePurposesInput = {
    id?: StringFieldUpdateOperationsInput | string
    organisationId?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    consentRecords?: ConsentRecordUncheckedUpdateManyWithoutPurposeNestedInput
  }

  export type WebsiteCreateWithoutConsentRecordsInput = {
    id?: string
    name: string
    domain: string
    publicKey: string
    isActive?: boolean
    createdAt?: Date | string
    organisation: OrganisationCreateNestedOneWithoutWebsitesInput
    sessions?: SessionCreateNestedManyWithoutWebsiteInput
    events?: EventCreateNestedManyWithoutWebsiteInput
    principals?: PrincipalCreateNestedManyWithoutWebsiteInput
  }

  export type WebsiteUncheckedCreateWithoutConsentRecordsInput = {
    id?: string
    organisationId: string
    name: string
    domain: string
    publicKey: string
    isActive?: boolean
    createdAt?: Date | string
    sessions?: SessionUncheckedCreateNestedManyWithoutWebsiteInput
    events?: EventUncheckedCreateNestedManyWithoutWebsiteInput
    principals?: PrincipalUncheckedCreateNestedManyWithoutWebsiteInput
  }

  export type WebsiteCreateOrConnectWithoutConsentRecordsInput = {
    where: WebsiteWhereUniqueInput
    create: XOR<WebsiteCreateWithoutConsentRecordsInput, WebsiteUncheckedCreateWithoutConsentRecordsInput>
  }

  export type PrincipalCreateWithoutConsentRecordsInput = {
    id?: string
    externalId: string
    kind?: string
    createdAt?: Date | string
    website: WebsiteCreateNestedOneWithoutPrincipalsInput
  }

  export type PrincipalUncheckedCreateWithoutConsentRecordsInput = {
    id?: string
    siteId: string
    externalId: string
    kind?: string
    createdAt?: Date | string
  }

  export type PrincipalCreateOrConnectWithoutConsentRecordsInput = {
    where: PrincipalWhereUniqueInput
    create: XOR<PrincipalCreateWithoutConsentRecordsInput, PrincipalUncheckedCreateWithoutConsentRecordsInput>
  }

  export type PurposeCreateWithoutConsentRecordsInput = {
    id?: string
    code: string
    name: string
    description: string
    isActive?: boolean
    createdAt?: Date | string
    organisation: OrganisationCreateNestedOneWithoutPurposesInput
    noticePurposes?: NoticePurposeCreateNestedManyWithoutPurposeInput
  }

  export type PurposeUncheckedCreateWithoutConsentRecordsInput = {
    id?: string
    organisationId: string
    code: string
    name: string
    description: string
    isActive?: boolean
    createdAt?: Date | string
    noticePurposes?: NoticePurposeUncheckedCreateNestedManyWithoutPurposeInput
  }

  export type PurposeCreateOrConnectWithoutConsentRecordsInput = {
    where: PurposeWhereUniqueInput
    create: XOR<PurposeCreateWithoutConsentRecordsInput, PurposeUncheckedCreateWithoutConsentRecordsInput>
  }

  export type NoticeCreateWithoutConsentRecordsInput = {
    id?: string
    version: string
    locale?: string
    publishedAt?: Date | string
    organisation: OrganisationCreateNestedOneWithoutNoticesInput
    policyVersion: PolicyVersionCreateNestedOneWithoutNoticesInput
    purposes?: NoticePurposeCreateNestedManyWithoutNoticeInput
  }

  export type NoticeUncheckedCreateWithoutConsentRecordsInput = {
    id?: string
    organisationId: string
    policyVersionId: string
    version: string
    locale?: string
    publishedAt?: Date | string
    purposes?: NoticePurposeUncheckedCreateNestedManyWithoutNoticeInput
  }

  export type NoticeCreateOrConnectWithoutConsentRecordsInput = {
    where: NoticeWhereUniqueInput
    create: XOR<NoticeCreateWithoutConsentRecordsInput, NoticeUncheckedCreateWithoutConsentRecordsInput>
  }

  export type PolicyVersionCreateWithoutConsentRecordsInput = {
    id?: string
    version: string
    documentUrl?: string | null
    contentHash?: string | null
    publishedAt?: Date | string
    policy: PolicyCreateNestedOneWithoutVersionsInput
    notices?: NoticeCreateNestedManyWithoutPolicyVersionInput
  }

  export type PolicyVersionUncheckedCreateWithoutConsentRecordsInput = {
    id?: string
    organisationId: string
    policyId: string
    version: string
    documentUrl?: string | null
    contentHash?: string | null
    publishedAt?: Date | string
    notices?: NoticeUncheckedCreateNestedManyWithoutPolicyVersionInput
  }

  export type PolicyVersionCreateOrConnectWithoutConsentRecordsInput = {
    where: PolicyVersionWhereUniqueInput
    create: XOR<PolicyVersionCreateWithoutConsentRecordsInput, PolicyVersionUncheckedCreateWithoutConsentRecordsInput>
  }

  export type WebsiteUpsertWithoutConsentRecordsInput = {
    update: XOR<WebsiteUpdateWithoutConsentRecordsInput, WebsiteUncheckedUpdateWithoutConsentRecordsInput>
    create: XOR<WebsiteCreateWithoutConsentRecordsInput, WebsiteUncheckedCreateWithoutConsentRecordsInput>
    where?: WebsiteWhereInput
  }

  export type WebsiteUpdateToOneWithWhereWithoutConsentRecordsInput = {
    where?: WebsiteWhereInput
    data: XOR<WebsiteUpdateWithoutConsentRecordsInput, WebsiteUncheckedUpdateWithoutConsentRecordsInput>
  }

  export type WebsiteUpdateWithoutConsentRecordsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    domain?: StringFieldUpdateOperationsInput | string
    publicKey?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    organisation?: OrganisationUpdateOneRequiredWithoutWebsitesNestedInput
    sessions?: SessionUpdateManyWithoutWebsiteNestedInput
    events?: EventUpdateManyWithoutWebsiteNestedInput
    principals?: PrincipalUpdateManyWithoutWebsiteNestedInput
  }

  export type WebsiteUncheckedUpdateWithoutConsentRecordsInput = {
    id?: StringFieldUpdateOperationsInput | string
    organisationId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    domain?: StringFieldUpdateOperationsInput | string
    publicKey?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sessions?: SessionUncheckedUpdateManyWithoutWebsiteNestedInput
    events?: EventUncheckedUpdateManyWithoutWebsiteNestedInput
    principals?: PrincipalUncheckedUpdateManyWithoutWebsiteNestedInput
  }

  export type PrincipalUpsertWithoutConsentRecordsInput = {
    update: XOR<PrincipalUpdateWithoutConsentRecordsInput, PrincipalUncheckedUpdateWithoutConsentRecordsInput>
    create: XOR<PrincipalCreateWithoutConsentRecordsInput, PrincipalUncheckedCreateWithoutConsentRecordsInput>
    where?: PrincipalWhereInput
  }

  export type PrincipalUpdateToOneWithWhereWithoutConsentRecordsInput = {
    where?: PrincipalWhereInput
    data: XOR<PrincipalUpdateWithoutConsentRecordsInput, PrincipalUncheckedUpdateWithoutConsentRecordsInput>
  }

  export type PrincipalUpdateWithoutConsentRecordsInput = {
    id?: StringFieldUpdateOperationsInput | string
    externalId?: StringFieldUpdateOperationsInput | string
    kind?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    website?: WebsiteUpdateOneRequiredWithoutPrincipalsNestedInput
  }

  export type PrincipalUncheckedUpdateWithoutConsentRecordsInput = {
    id?: StringFieldUpdateOperationsInput | string
    siteId?: StringFieldUpdateOperationsInput | string
    externalId?: StringFieldUpdateOperationsInput | string
    kind?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PurposeUpsertWithoutConsentRecordsInput = {
    update: XOR<PurposeUpdateWithoutConsentRecordsInput, PurposeUncheckedUpdateWithoutConsentRecordsInput>
    create: XOR<PurposeCreateWithoutConsentRecordsInput, PurposeUncheckedCreateWithoutConsentRecordsInput>
    where?: PurposeWhereInput
  }

  export type PurposeUpdateToOneWithWhereWithoutConsentRecordsInput = {
    where?: PurposeWhereInput
    data: XOR<PurposeUpdateWithoutConsentRecordsInput, PurposeUncheckedUpdateWithoutConsentRecordsInput>
  }

  export type PurposeUpdateWithoutConsentRecordsInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    organisation?: OrganisationUpdateOneRequiredWithoutPurposesNestedInput
    noticePurposes?: NoticePurposeUpdateManyWithoutPurposeNestedInput
  }

  export type PurposeUncheckedUpdateWithoutConsentRecordsInput = {
    id?: StringFieldUpdateOperationsInput | string
    organisationId?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    noticePurposes?: NoticePurposeUncheckedUpdateManyWithoutPurposeNestedInput
  }

  export type NoticeUpsertWithoutConsentRecordsInput = {
    update: XOR<NoticeUpdateWithoutConsentRecordsInput, NoticeUncheckedUpdateWithoutConsentRecordsInput>
    create: XOR<NoticeCreateWithoutConsentRecordsInput, NoticeUncheckedCreateWithoutConsentRecordsInput>
    where?: NoticeWhereInput
  }

  export type NoticeUpdateToOneWithWhereWithoutConsentRecordsInput = {
    where?: NoticeWhereInput
    data: XOR<NoticeUpdateWithoutConsentRecordsInput, NoticeUncheckedUpdateWithoutConsentRecordsInput>
  }

  export type NoticeUpdateWithoutConsentRecordsInput = {
    id?: StringFieldUpdateOperationsInput | string
    version?: StringFieldUpdateOperationsInput | string
    locale?: StringFieldUpdateOperationsInput | string
    publishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    organisation?: OrganisationUpdateOneRequiredWithoutNoticesNestedInput
    policyVersion?: PolicyVersionUpdateOneRequiredWithoutNoticesNestedInput
    purposes?: NoticePurposeUpdateManyWithoutNoticeNestedInput
  }

  export type NoticeUncheckedUpdateWithoutConsentRecordsInput = {
    id?: StringFieldUpdateOperationsInput | string
    organisationId?: StringFieldUpdateOperationsInput | string
    policyVersionId?: StringFieldUpdateOperationsInput | string
    version?: StringFieldUpdateOperationsInput | string
    locale?: StringFieldUpdateOperationsInput | string
    publishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    purposes?: NoticePurposeUncheckedUpdateManyWithoutNoticeNestedInput
  }

  export type PolicyVersionUpsertWithoutConsentRecordsInput = {
    update: XOR<PolicyVersionUpdateWithoutConsentRecordsInput, PolicyVersionUncheckedUpdateWithoutConsentRecordsInput>
    create: XOR<PolicyVersionCreateWithoutConsentRecordsInput, PolicyVersionUncheckedCreateWithoutConsentRecordsInput>
    where?: PolicyVersionWhereInput
  }

  export type PolicyVersionUpdateToOneWithWhereWithoutConsentRecordsInput = {
    where?: PolicyVersionWhereInput
    data: XOR<PolicyVersionUpdateWithoutConsentRecordsInput, PolicyVersionUncheckedUpdateWithoutConsentRecordsInput>
  }

  export type PolicyVersionUpdateWithoutConsentRecordsInput = {
    id?: StringFieldUpdateOperationsInput | string
    version?: StringFieldUpdateOperationsInput | string
    documentUrl?: NullableStringFieldUpdateOperationsInput | string | null
    contentHash?: NullableStringFieldUpdateOperationsInput | string | null
    publishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    policy?: PolicyUpdateOneRequiredWithoutVersionsNestedInput
    notices?: NoticeUpdateManyWithoutPolicyVersionNestedInput
  }

  export type PolicyVersionUncheckedUpdateWithoutConsentRecordsInput = {
    id?: StringFieldUpdateOperationsInput | string
    organisationId?: StringFieldUpdateOperationsInput | string
    policyId?: StringFieldUpdateOperationsInput | string
    version?: StringFieldUpdateOperationsInput | string
    documentUrl?: NullableStringFieldUpdateOperationsInput | string | null
    contentHash?: NullableStringFieldUpdateOperationsInput | string | null
    publishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    notices?: NoticeUncheckedUpdateManyWithoutPolicyVersionNestedInput
  }

  export type WebsiteCreateManyOrganisationInput = {
    id?: string
    name: string
    domain: string
    publicKey: string
    isActive?: boolean
    createdAt?: Date | string
  }

  export type PurposeCreateManyOrganisationInput = {
    id?: string
    code: string
    name: string
    description: string
    isActive?: boolean
    createdAt?: Date | string
  }

  export type PolicyCreateManyOrganisationInput = {
    id?: string
    code: string
    name: string
    createdAt?: Date | string
  }

  export type NoticeCreateManyOrganisationInput = {
    id?: string
    policyVersionId: string
    version: string
    locale?: string
    publishedAt?: Date | string
  }

  export type WebsiteUpdateWithoutOrganisationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    domain?: StringFieldUpdateOperationsInput | string
    publicKey?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sessions?: SessionUpdateManyWithoutWebsiteNestedInput
    events?: EventUpdateManyWithoutWebsiteNestedInput
    principals?: PrincipalUpdateManyWithoutWebsiteNestedInput
    consentRecords?: ConsentRecordUpdateManyWithoutWebsiteNestedInput
  }

  export type WebsiteUncheckedUpdateWithoutOrganisationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    domain?: StringFieldUpdateOperationsInput | string
    publicKey?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sessions?: SessionUncheckedUpdateManyWithoutWebsiteNestedInput
    events?: EventUncheckedUpdateManyWithoutWebsiteNestedInput
    principals?: PrincipalUncheckedUpdateManyWithoutWebsiteNestedInput
    consentRecords?: ConsentRecordUncheckedUpdateManyWithoutWebsiteNestedInput
  }

  export type WebsiteUncheckedUpdateManyWithoutOrganisationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    domain?: StringFieldUpdateOperationsInput | string
    publicKey?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PurposeUpdateWithoutOrganisationInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    noticePurposes?: NoticePurposeUpdateManyWithoutPurposeNestedInput
    consentRecords?: ConsentRecordUpdateManyWithoutPurposeNestedInput
  }

  export type PurposeUncheckedUpdateWithoutOrganisationInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    noticePurposes?: NoticePurposeUncheckedUpdateManyWithoutPurposeNestedInput
    consentRecords?: ConsentRecordUncheckedUpdateManyWithoutPurposeNestedInput
  }

  export type PurposeUncheckedUpdateManyWithoutOrganisationInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PolicyUpdateWithoutOrganisationInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    versions?: PolicyVersionUpdateManyWithoutPolicyNestedInput
  }

  export type PolicyUncheckedUpdateWithoutOrganisationInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    versions?: PolicyVersionUncheckedUpdateManyWithoutPolicyNestedInput
  }

  export type PolicyUncheckedUpdateManyWithoutOrganisationInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type NoticeUpdateWithoutOrganisationInput = {
    id?: StringFieldUpdateOperationsInput | string
    version?: StringFieldUpdateOperationsInput | string
    locale?: StringFieldUpdateOperationsInput | string
    publishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    policyVersion?: PolicyVersionUpdateOneRequiredWithoutNoticesNestedInput
    purposes?: NoticePurposeUpdateManyWithoutNoticeNestedInput
    consentRecords?: ConsentRecordUpdateManyWithoutNoticeNestedInput
  }

  export type NoticeUncheckedUpdateWithoutOrganisationInput = {
    id?: StringFieldUpdateOperationsInput | string
    policyVersionId?: StringFieldUpdateOperationsInput | string
    version?: StringFieldUpdateOperationsInput | string
    locale?: StringFieldUpdateOperationsInput | string
    publishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    purposes?: NoticePurposeUncheckedUpdateManyWithoutNoticeNestedInput
    consentRecords?: ConsentRecordUncheckedUpdateManyWithoutNoticeNestedInput
  }

  export type NoticeUncheckedUpdateManyWithoutOrganisationInput = {
    id?: StringFieldUpdateOperationsInput | string
    policyVersionId?: StringFieldUpdateOperationsInput | string
    version?: StringFieldUpdateOperationsInput | string
    locale?: StringFieldUpdateOperationsInput | string
    publishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SessionCreateManyWebsiteInput = {
    id?: string
    startedAt?: Date | string
    lastActivity: Date | string
  }

  export type EventCreateManyWebsiteInput = {
    id?: string
    eventId: string
    sessionId: string
    eventType: string
    name?: string | null
    eventTime: Date | string
    pageUrl: string
    pageTitle: string
    referrer?: string | null
    deviceType: string
    browser: string
    os: string
    properties?: NullableJsonNullValueInput | InputJsonValue
    receivedAt?: Date | string
  }

  export type PrincipalCreateManyWebsiteInput = {
    id?: string
    externalId: string
    kind?: string
    createdAt?: Date | string
  }

  export type ConsentRecordCreateManyWebsiteInput = {
    id?: string
    principalId: string
    purposeId: string
    noticeId?: string | null
    policyVersionId?: string | null
    status: string
    source?: string
    decidedAt: Date | string
    recordedAt?: Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
  }

  export type SessionUpdateWithoutWebsiteInput = {
    id?: StringFieldUpdateOperationsInput | string
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    lastActivity?: DateTimeFieldUpdateOperationsInput | Date | string
    events?: EventUpdateManyWithoutSessionNestedInput
  }

  export type SessionUncheckedUpdateWithoutWebsiteInput = {
    id?: StringFieldUpdateOperationsInput | string
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    lastActivity?: DateTimeFieldUpdateOperationsInput | Date | string
    events?: EventUncheckedUpdateManyWithoutSessionNestedInput
  }

  export type SessionUncheckedUpdateManyWithoutWebsiteInput = {
    id?: StringFieldUpdateOperationsInput | string
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    lastActivity?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EventUpdateWithoutWebsiteInput = {
    id?: StringFieldUpdateOperationsInput | string
    eventId?: StringFieldUpdateOperationsInput | string
    eventType?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    eventTime?: DateTimeFieldUpdateOperationsInput | Date | string
    pageUrl?: StringFieldUpdateOperationsInput | string
    pageTitle?: StringFieldUpdateOperationsInput | string
    referrer?: NullableStringFieldUpdateOperationsInput | string | null
    deviceType?: StringFieldUpdateOperationsInput | string
    browser?: StringFieldUpdateOperationsInput | string
    os?: StringFieldUpdateOperationsInput | string
    properties?: NullableJsonNullValueInput | InputJsonValue
    receivedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    session?: SessionUpdateOneRequiredWithoutEventsNestedInput
  }

  export type EventUncheckedUpdateWithoutWebsiteInput = {
    id?: StringFieldUpdateOperationsInput | string
    eventId?: StringFieldUpdateOperationsInput | string
    sessionId?: StringFieldUpdateOperationsInput | string
    eventType?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    eventTime?: DateTimeFieldUpdateOperationsInput | Date | string
    pageUrl?: StringFieldUpdateOperationsInput | string
    pageTitle?: StringFieldUpdateOperationsInput | string
    referrer?: NullableStringFieldUpdateOperationsInput | string | null
    deviceType?: StringFieldUpdateOperationsInput | string
    browser?: StringFieldUpdateOperationsInput | string
    os?: StringFieldUpdateOperationsInput | string
    properties?: NullableJsonNullValueInput | InputJsonValue
    receivedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EventUncheckedUpdateManyWithoutWebsiteInput = {
    id?: StringFieldUpdateOperationsInput | string
    eventId?: StringFieldUpdateOperationsInput | string
    sessionId?: StringFieldUpdateOperationsInput | string
    eventType?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    eventTime?: DateTimeFieldUpdateOperationsInput | Date | string
    pageUrl?: StringFieldUpdateOperationsInput | string
    pageTitle?: StringFieldUpdateOperationsInput | string
    referrer?: NullableStringFieldUpdateOperationsInput | string | null
    deviceType?: StringFieldUpdateOperationsInput | string
    browser?: StringFieldUpdateOperationsInput | string
    os?: StringFieldUpdateOperationsInput | string
    properties?: NullableJsonNullValueInput | InputJsonValue
    receivedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PrincipalUpdateWithoutWebsiteInput = {
    id?: StringFieldUpdateOperationsInput | string
    externalId?: StringFieldUpdateOperationsInput | string
    kind?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    consentRecords?: ConsentRecordUpdateManyWithoutPrincipalNestedInput
  }

  export type PrincipalUncheckedUpdateWithoutWebsiteInput = {
    id?: StringFieldUpdateOperationsInput | string
    externalId?: StringFieldUpdateOperationsInput | string
    kind?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    consentRecords?: ConsentRecordUncheckedUpdateManyWithoutPrincipalNestedInput
  }

  export type PrincipalUncheckedUpdateManyWithoutWebsiteInput = {
    id?: StringFieldUpdateOperationsInput | string
    externalId?: StringFieldUpdateOperationsInput | string
    kind?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ConsentRecordUpdateWithoutWebsiteInput = {
    id?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    source?: StringFieldUpdateOperationsInput | string
    decidedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    recordedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
    principal?: PrincipalUpdateOneRequiredWithoutConsentRecordsNestedInput
    purpose?: PurposeUpdateOneRequiredWithoutConsentRecordsNestedInput
    notice?: NoticeUpdateOneWithoutConsentRecordsNestedInput
    policyVersion?: PolicyVersionUpdateOneWithoutConsentRecordsNestedInput
  }

  export type ConsentRecordUncheckedUpdateWithoutWebsiteInput = {
    id?: StringFieldUpdateOperationsInput | string
    principalId?: StringFieldUpdateOperationsInput | string
    purposeId?: StringFieldUpdateOperationsInput | string
    noticeId?: NullableStringFieldUpdateOperationsInput | string | null
    policyVersionId?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    source?: StringFieldUpdateOperationsInput | string
    decidedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    recordedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
  }

  export type ConsentRecordUncheckedUpdateManyWithoutWebsiteInput = {
    id?: StringFieldUpdateOperationsInput | string
    principalId?: StringFieldUpdateOperationsInput | string
    purposeId?: StringFieldUpdateOperationsInput | string
    noticeId?: NullableStringFieldUpdateOperationsInput | string | null
    policyVersionId?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    source?: StringFieldUpdateOperationsInput | string
    decidedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    recordedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
  }

  export type EventCreateManySessionInput = {
    id?: string
    eventId: string
    eventType: string
    name?: string | null
    eventTime: Date | string
    pageUrl: string
    pageTitle: string
    referrer?: string | null
    deviceType: string
    browser: string
    os: string
    properties?: NullableJsonNullValueInput | InputJsonValue
    receivedAt?: Date | string
  }

  export type EventUpdateWithoutSessionInput = {
    id?: StringFieldUpdateOperationsInput | string
    eventId?: StringFieldUpdateOperationsInput | string
    eventType?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    eventTime?: DateTimeFieldUpdateOperationsInput | Date | string
    pageUrl?: StringFieldUpdateOperationsInput | string
    pageTitle?: StringFieldUpdateOperationsInput | string
    referrer?: NullableStringFieldUpdateOperationsInput | string | null
    deviceType?: StringFieldUpdateOperationsInput | string
    browser?: StringFieldUpdateOperationsInput | string
    os?: StringFieldUpdateOperationsInput | string
    properties?: NullableJsonNullValueInput | InputJsonValue
    receivedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    website?: WebsiteUpdateOneRequiredWithoutEventsNestedInput
  }

  export type EventUncheckedUpdateWithoutSessionInput = {
    id?: StringFieldUpdateOperationsInput | string
    eventId?: StringFieldUpdateOperationsInput | string
    eventType?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    eventTime?: DateTimeFieldUpdateOperationsInput | Date | string
    pageUrl?: StringFieldUpdateOperationsInput | string
    pageTitle?: StringFieldUpdateOperationsInput | string
    referrer?: NullableStringFieldUpdateOperationsInput | string | null
    deviceType?: StringFieldUpdateOperationsInput | string
    browser?: StringFieldUpdateOperationsInput | string
    os?: StringFieldUpdateOperationsInput | string
    properties?: NullableJsonNullValueInput | InputJsonValue
    receivedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EventUncheckedUpdateManyWithoutSessionInput = {
    id?: StringFieldUpdateOperationsInput | string
    eventId?: StringFieldUpdateOperationsInput | string
    eventType?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    eventTime?: DateTimeFieldUpdateOperationsInput | Date | string
    pageUrl?: StringFieldUpdateOperationsInput | string
    pageTitle?: StringFieldUpdateOperationsInput | string
    referrer?: NullableStringFieldUpdateOperationsInput | string | null
    deviceType?: StringFieldUpdateOperationsInput | string
    browser?: StringFieldUpdateOperationsInput | string
    os?: StringFieldUpdateOperationsInput | string
    properties?: NullableJsonNullValueInput | InputJsonValue
    receivedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ConsentRecordCreateManyPrincipalInput = {
    id?: string
    organisationId: string
    purposeId: string
    noticeId?: string | null
    policyVersionId?: string | null
    status: string
    source?: string
    decidedAt: Date | string
    recordedAt?: Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
  }

  export type ConsentRecordUpdateWithoutPrincipalInput = {
    id?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    source?: StringFieldUpdateOperationsInput | string
    decidedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    recordedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
    website?: WebsiteUpdateOneRequiredWithoutConsentRecordsNestedInput
    purpose?: PurposeUpdateOneRequiredWithoutConsentRecordsNestedInput
    notice?: NoticeUpdateOneWithoutConsentRecordsNestedInput
    policyVersion?: PolicyVersionUpdateOneWithoutConsentRecordsNestedInput
  }

  export type ConsentRecordUncheckedUpdateWithoutPrincipalInput = {
    id?: StringFieldUpdateOperationsInput | string
    organisationId?: StringFieldUpdateOperationsInput | string
    purposeId?: StringFieldUpdateOperationsInput | string
    noticeId?: NullableStringFieldUpdateOperationsInput | string | null
    policyVersionId?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    source?: StringFieldUpdateOperationsInput | string
    decidedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    recordedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
  }

  export type ConsentRecordUncheckedUpdateManyWithoutPrincipalInput = {
    id?: StringFieldUpdateOperationsInput | string
    organisationId?: StringFieldUpdateOperationsInput | string
    purposeId?: StringFieldUpdateOperationsInput | string
    noticeId?: NullableStringFieldUpdateOperationsInput | string | null
    policyVersionId?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    source?: StringFieldUpdateOperationsInput | string
    decidedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    recordedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
  }

  export type NoticePurposeCreateManyPurposeInput = {
    noticeId: string
  }

  export type ConsentRecordCreateManyPurposeInput = {
    id?: string
    siteId: string
    principalId: string
    noticeId?: string | null
    policyVersionId?: string | null
    status: string
    source?: string
    decidedAt: Date | string
    recordedAt?: Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
  }

  export type NoticePurposeUpdateWithoutPurposeInput = {
    notice?: NoticeUpdateOneRequiredWithoutPurposesNestedInput
  }

  export type NoticePurposeUncheckedUpdateWithoutPurposeInput = {
    noticeId?: StringFieldUpdateOperationsInput | string
  }

  export type NoticePurposeUncheckedUpdateManyWithoutPurposeInput = {
    noticeId?: StringFieldUpdateOperationsInput | string
  }

  export type ConsentRecordUpdateWithoutPurposeInput = {
    id?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    source?: StringFieldUpdateOperationsInput | string
    decidedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    recordedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
    website?: WebsiteUpdateOneRequiredWithoutConsentRecordsNestedInput
    principal?: PrincipalUpdateOneRequiredWithoutConsentRecordsNestedInput
    notice?: NoticeUpdateOneWithoutConsentRecordsNestedInput
    policyVersion?: PolicyVersionUpdateOneWithoutConsentRecordsNestedInput
  }

  export type ConsentRecordUncheckedUpdateWithoutPurposeInput = {
    id?: StringFieldUpdateOperationsInput | string
    siteId?: StringFieldUpdateOperationsInput | string
    principalId?: StringFieldUpdateOperationsInput | string
    noticeId?: NullableStringFieldUpdateOperationsInput | string | null
    policyVersionId?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    source?: StringFieldUpdateOperationsInput | string
    decidedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    recordedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
  }

  export type ConsentRecordUncheckedUpdateManyWithoutPurposeInput = {
    id?: StringFieldUpdateOperationsInput | string
    siteId?: StringFieldUpdateOperationsInput | string
    principalId?: StringFieldUpdateOperationsInput | string
    noticeId?: NullableStringFieldUpdateOperationsInput | string | null
    policyVersionId?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    source?: StringFieldUpdateOperationsInput | string
    decidedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    recordedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
  }

  export type PolicyVersionCreateManyPolicyInput = {
    id?: string
    version: string
    documentUrl?: string | null
    contentHash?: string | null
    publishedAt?: Date | string
  }

  export type PolicyVersionUpdateWithoutPolicyInput = {
    id?: StringFieldUpdateOperationsInput | string
    version?: StringFieldUpdateOperationsInput | string
    documentUrl?: NullableStringFieldUpdateOperationsInput | string | null
    contentHash?: NullableStringFieldUpdateOperationsInput | string | null
    publishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    notices?: NoticeUpdateManyWithoutPolicyVersionNestedInput
    consentRecords?: ConsentRecordUpdateManyWithoutPolicyVersionNestedInput
  }

  export type PolicyVersionUncheckedUpdateWithoutPolicyInput = {
    id?: StringFieldUpdateOperationsInput | string
    version?: StringFieldUpdateOperationsInput | string
    documentUrl?: NullableStringFieldUpdateOperationsInput | string | null
    contentHash?: NullableStringFieldUpdateOperationsInput | string | null
    publishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    notices?: NoticeUncheckedUpdateManyWithoutPolicyVersionNestedInput
    consentRecords?: ConsentRecordUncheckedUpdateManyWithoutPolicyVersionNestedInput
  }

  export type PolicyVersionUncheckedUpdateManyWithoutPolicyInput = {
    id?: StringFieldUpdateOperationsInput | string
    version?: StringFieldUpdateOperationsInput | string
    documentUrl?: NullableStringFieldUpdateOperationsInput | string | null
    contentHash?: NullableStringFieldUpdateOperationsInput | string | null
    publishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type NoticeCreateManyPolicyVersionInput = {
    id?: string
    version: string
    locale?: string
    publishedAt?: Date | string
  }

  export type ConsentRecordCreateManyPolicyVersionInput = {
    id?: string
    siteId: string
    principalId: string
    purposeId: string
    noticeId?: string | null
    status: string
    source?: string
    decidedAt: Date | string
    recordedAt?: Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
  }

  export type NoticeUpdateWithoutPolicyVersionInput = {
    id?: StringFieldUpdateOperationsInput | string
    version?: StringFieldUpdateOperationsInput | string
    locale?: StringFieldUpdateOperationsInput | string
    publishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    organisation?: OrganisationUpdateOneRequiredWithoutNoticesNestedInput
    purposes?: NoticePurposeUpdateManyWithoutNoticeNestedInput
    consentRecords?: ConsentRecordUpdateManyWithoutNoticeNestedInput
  }

  export type NoticeUncheckedUpdateWithoutPolicyVersionInput = {
    id?: StringFieldUpdateOperationsInput | string
    version?: StringFieldUpdateOperationsInput | string
    locale?: StringFieldUpdateOperationsInput | string
    publishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    purposes?: NoticePurposeUncheckedUpdateManyWithoutNoticeNestedInput
    consentRecords?: ConsentRecordUncheckedUpdateManyWithoutNoticeNestedInput
  }

  export type NoticeUncheckedUpdateManyWithoutPolicyVersionInput = {
    id?: StringFieldUpdateOperationsInput | string
    version?: StringFieldUpdateOperationsInput | string
    locale?: StringFieldUpdateOperationsInput | string
    publishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ConsentRecordUpdateWithoutPolicyVersionInput = {
    id?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    source?: StringFieldUpdateOperationsInput | string
    decidedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    recordedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
    website?: WebsiteUpdateOneRequiredWithoutConsentRecordsNestedInput
    principal?: PrincipalUpdateOneRequiredWithoutConsentRecordsNestedInput
    purpose?: PurposeUpdateOneRequiredWithoutConsentRecordsNestedInput
    notice?: NoticeUpdateOneWithoutConsentRecordsNestedInput
  }

  export type ConsentRecordUncheckedUpdateWithoutPolicyVersionInput = {
    id?: StringFieldUpdateOperationsInput | string
    siteId?: StringFieldUpdateOperationsInput | string
    principalId?: StringFieldUpdateOperationsInput | string
    purposeId?: StringFieldUpdateOperationsInput | string
    noticeId?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    source?: StringFieldUpdateOperationsInput | string
    decidedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    recordedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
  }

  export type ConsentRecordUncheckedUpdateManyWithoutPolicyVersionInput = {
    id?: StringFieldUpdateOperationsInput | string
    siteId?: StringFieldUpdateOperationsInput | string
    principalId?: StringFieldUpdateOperationsInput | string
    purposeId?: StringFieldUpdateOperationsInput | string
    noticeId?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    source?: StringFieldUpdateOperationsInput | string
    decidedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    recordedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
  }

  export type NoticePurposeCreateManyNoticeInput = {
    purposeId: string
  }

  export type ConsentRecordCreateManyNoticeInput = {
    id?: string
    siteId: string
    principalId: string
    purposeId: string
    policyVersionId?: string | null
    status: string
    source?: string
    decidedAt: Date | string
    recordedAt?: Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
  }

  export type NoticePurposeUpdateWithoutNoticeInput = {
    purpose?: PurposeUpdateOneRequiredWithoutNoticePurposesNestedInput
  }

  export type NoticePurposeUncheckedUpdateWithoutNoticeInput = {
    purposeId?: StringFieldUpdateOperationsInput | string
  }

  export type NoticePurposeUncheckedUpdateManyWithoutNoticeInput = {
    purposeId?: StringFieldUpdateOperationsInput | string
  }

  export type ConsentRecordUpdateWithoutNoticeInput = {
    id?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    source?: StringFieldUpdateOperationsInput | string
    decidedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    recordedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
    website?: WebsiteUpdateOneRequiredWithoutConsentRecordsNestedInput
    principal?: PrincipalUpdateOneRequiredWithoutConsentRecordsNestedInput
    purpose?: PurposeUpdateOneRequiredWithoutConsentRecordsNestedInput
    policyVersion?: PolicyVersionUpdateOneWithoutConsentRecordsNestedInput
  }

  export type ConsentRecordUncheckedUpdateWithoutNoticeInput = {
    id?: StringFieldUpdateOperationsInput | string
    siteId?: StringFieldUpdateOperationsInput | string
    principalId?: StringFieldUpdateOperationsInput | string
    purposeId?: StringFieldUpdateOperationsInput | string
    policyVersionId?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    source?: StringFieldUpdateOperationsInput | string
    decidedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    recordedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
  }

  export type ConsentRecordUncheckedUpdateManyWithoutNoticeInput = {
    id?: StringFieldUpdateOperationsInput | string
    siteId?: StringFieldUpdateOperationsInput | string
    principalId?: StringFieldUpdateOperationsInput | string
    purposeId?: StringFieldUpdateOperationsInput | string
    policyVersionId?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    source?: StringFieldUpdateOperationsInput | string
    decidedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    recordedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}