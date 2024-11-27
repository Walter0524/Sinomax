// ===== 基础类型

type MapToTyped<T> = { [name: string]: T }

type MapToAny = { [name: string]: any }

type MapToSimple = MapToTyped<string | number | boolean>

// ===== Java 类型

declare interface JavaType {
  type(ref: string): any
}

declare const Java: JavaType

declare interface JavaMap {
  //
}

declare interface Date {
  getTime: () => number
}

declare interface TraceContext {
  //
}

// ===== 基础功能

declare interface ScriptBase {
  traceContext: () => TraceContext
  logDebug: (tc: TraceContext, msg: string) => void
  logInfo: (tc: TraceContext, msg: string) => void
  logError: (tc: TraceContext, msg: string, err: any | null) => void
  scheduledAtFixedDelay: (name: string, delay: number, work: (counter: number) => void) => void
  robustExecute: (tc: TraceContext, description: string, func: string, args: MapToSimple) => void
  runOnce: (tc: TraceContext, mainId: string, actionId: string, work: () => MapToAny) => MapToAny
  withLock: (name: string, action: () => void) => void
  parseJsonString: (str: string) => MapToAny
  jsonToString: (o: any) => string | null
  xmlToJsonStr: (o: string | number) => any | null
  now: () => Date
  throwBzError: (code: string, args: any[]) => any
  assignJavaMapToJsMap: (jsMap: MapToAny, javaMap: JavaMap) => void
  setScriptButtons: (buttons: string) => void
  getGlobalValue: (key: string) => any | null
  setGlobalValue: (key: string, value: any | null) => void
  recordFailure: (tc: TraceContext, failure: FailureRecordReq) => void
}

interface FailureRecordReq {
  kind: string,  // 类别
  subKind?: string,// 子类别
  level?: FailureLevel,
  source?: string, // 来源
  part?: string, // 对象
  desc: string,
}

declare type FailureLevel = "Warning" | "Normal" | "Fatal"

declare const base: ScriptBase

declare interface ScriptThread {
  createThread: (name: string, func: string) => void
  sleep: (ms: number) => void
  interrupted: () => boolean
}

declare const thread: ScriptThread

declare interface HttpServer {
  registerHandler: (method: string, path: string, func: string, auth: boolean) => void
}

declare interface HttpServerContext {
  getBodyAsString: () => string
  setJson: (jo: any) => void
}

declare const httpServer: HttpServer

declare interface HttpClient {
  request: (tc: TraceContext, reqStr: string) => HttpResult
  requestJson: (method: string, url: string, reqBody: MapToAny | null, headers: MapToTyped<string> | null) => HttpResult
  requestXml: (method: string, url: string, reqBody?: any, headers?: MapToTyped<string>, auth?: MapToTyped<string>) => HttpResult
  syncCall: (tc: TraceContext, reqStr: string, okChecker: (res: HttpResult) => boolean, oStr: string | null) => HttpResult
  asyncCallback: (tc: TraceContext, reqStr: string, okChecker: string, oStr: string | null) => string

  /**
   * 反复轮训直到成功。使用此方法的好处：不用自己写循环。优化日志，开始结束时打印日志。中间如果一致是相同结果，不重复打印日志。
   * purpose 是目的，写好了方便差错。
   * 后面会与 SOC 结合。
   */
  requestJsonUntil: (method: string, url: string, reqBody: any | null, headers: MapToTyped<string> | null,
                     purpose: string, delay: number, check: (r: HttpResult) => boolean) => HttpResult
}

declare const httpClient: HttpClient

declare interface HttpResult {
  successful: boolean
  ioError: boolean
  ioErrorMsg?: string | null
  code: number
  bodyString?: string | null
  checkRes?: boolean | null // 校验结果。后端会自动补上，不要手动赋值
  checkMsg?: string | null
}

declare type SocAttention = "None" | "Green" | "Yellow" | "Red"

declare interface Soc {
  updateStringNode: (id: string, desc: string, content: string, attention: SocAttention) => void
  updateIntNode: (id: string, desc: string, content: number, attention: SocAttention) => void
  updateJsonNode: (id: string, desc: string, content: any, attention: SocAttention) => void
  getNode: (id: string) => SocNode | null
  removeNode: (id: string) => void
}

declare const soc: Soc

declare interface SocNode {
  getId(): string

  getLabel(): string

  getValue(): any

  getAttention(): SocAttention
}


// ===== Entity

declare interface EntityMeta {
  getName: () => string
}

declare interface ComplexQuery {
}

declare interface Cq {
  all: () => ComplexQuery
  and: (items: ComplexQuery[]) => ComplexQuery
  or: (items: ComplexQuery[]) => ComplexQuery
  eq: (field1: string, v: any) => ComplexQuery
  ne: (field1: string, v: any) => ComplexQuery
  lt: (field1: string, v: any) => ComplexQuery
  lte: (field1: string, v: any) => ComplexQuery
  gt: (field1: string, v: any) => ComplexQuery
  gte: (field1: string, v: any) => ComplexQuery
  idEq: (id: string) => ComplexQuery
  include: (field1: string, items: any[]) => ComplexQuery
  empty: (field1: string) => ComplexQuery
  notEmpty: (field1: string) => ComplexQuery
}

declare const cq: Cq

interface CreateOptions {
  keepId?: boolean
}

interface UpdateOptions {
  limit?: number
}

interface RemoveOptions {
  limit?: number
}

interface FindOptions {
  projection?: string[]
  sort?: string[]
  skip?: number
  limit?: number
}

declare interface ScriptEntity {
  createOne: (tc: TraceContext, entityName: string, evJson: MapToAny, o: CreateOptions | null) => string
  createMany: (tc: TraceContext, entityName: string, evJsonList: MapToAny[], o: CreateOptions | null) => string[]
  updateOne: (tc: TraceContext, entityName: string, queryJson: ComplexQuery, updateJson: MapToAny, o: UpdateOptions | null) => number
  updateOneById: (tc: TraceContext, entityName: string, id: string, updateJson: MapToAny, o: UpdateOptions | null) => number
  updateMany: (tc: TraceContext, entityName: string, queryJson: ComplexQuery, updateJson: MapToAny, o: UpdateOptions | null) => number
  removeOne: (tc: TraceContext, entityName: string, queryJson: ComplexQuery, o: RemoveOptions | null) => number
  removeMany: (tc: TraceContext, entityName: string, queryJson: ComplexQuery, o: RemoveOptions | null) => number
  count: (tc: TraceContext, entityName: string, queryJson: ComplexQuery) => number
  findOne: (tc: TraceContext, entityName: string, queryJson: ComplexQuery, o: FindOptions | null) => MapToAny | null
  findOneById: (tc: TraceContext, entityName: string, id: string, o: FindOptions | null) => MapToAny | null
  findMany: (tc: TraceContext, entityName: string, queryJson: ComplexQuery, o: FindOptions | null) => MapToAny[]
  exists: (tc: TraceContext, entityName: string, queryJson: ComplexQuery) => boolean
  buildFindOptions: (projection: string[] | null, sort: string[] | null, skip: number | null, limit: number | null) => FindOptions
  clearCacheAll: () => void
  clearCacheByEntity: (entityName: string) => void
}

declare const entity: ScriptEntity

declare interface ScriptEntityExt {
  /**
   * 注意实体生命周期拦截器：实体新建前
   */
  extBeforeCreating: (entityName: string, func: string) => void

  /**
   * 注意实体生命周期拦截器：实体新建后
   */
  extAfterCreating: (entityName: string, func: string) => void

  /**
   * 注意实体生命周期拦截器：实体更新前
   */
  extBeforeUpdating: (entityName: string, func: string) => void

  /**
   * 注意实体生命周期拦截器：实体更新后
   */
  extAfterUpdating: (entityName: string, func: string) => void

  /**
   * 实体删除前
   */
  extBeforeRemoving: (entityName: string, func: string) => void

  /**
   * 实体删除后
   */
  extAfterRemoving: (entityName: string, func: string) => void
}

declare const entityExt: ScriptEntityExt

declare interface ScriptFalcon {
  runTaskByLabelAsync: (tc: TraceContext, defLabel: string, jsInputParams: MapToAny) => string
}

declare const falcon: ScriptFalcon

declare interface ScriptWcs {
  /**
   * 机器人是否在线
   */
  isRobotOnline: (robotName: string) => boolean
  mustGetRobotInfoAll: (id: string) => MrRobotInfoAll
  /**
   * 寻找离机器人最近的通讯点
   */
  findClosestRobotConnectedPoint: (robotName: string) => MapToAny | null
  buildHaiMoves: (tc: TraceContext, robotId: string, rawSteps: string) => MapToAny[]
  buildSeerMoves: (tc: TraceContext, robotId: string, rawSteps: string) => MapToAny[]
  /**
   * 未禁用、可接单、在线的机器人
   */
  listWorkableRobots: () => MrRobotInfoAll[]
  /**
   * 未禁用、可接单、在线、空闲（扩展任务状态）的机器人
   */
  listExtIdleRobots: () => MrRobotInfoAll[]
  /**
   * 采用 RunOnce 的方式，创建直接运单，并等待其完成
   */
  awaitRunOnceDirectRobotOrder: (tc: TraceContext, robotName: string, mainId: string, action: string, moves: MapToAny[]) => string
  mustGetBinRobotArgs: (bin: string, action: string) => BinRobotArgs
  mustGet3051Params: (bin: string, action: string) => MapToAny
  unlockByRobot: (tc: TraceContext, robotId: string) => void
  tryLockOneSiteByName: (tc: TraceContext, robotId: string, siteIds: string[]) => string | null
  /**
   * 重置所有扩展机器人，终止所有后台任务，清楚所有地图资源锁
   */
  resetExtRobots: (tc: TraceContext) => void
}

declare interface BinRobotArgs {
  bin: string
  action: string
  site: string
  fields: MapToAny
  rbkFields: MapToAny
}

declare interface MrRobotInfoAll {
  id: string
  systemConfig: MapToAny
  runtimeRecord: MapToAny | null
  selfReport: MrRobotSelfReport | null
  online: boolean
}

declare interface MrRobotSelfReport {
  error?: boolean
  errorMsg?: string | null
  main?: MrRobotSelfReportMain | null
  rawReport?: MapToAny | null
  timestamp?: any
}

declare interface MrRobotSelfReportMain {
  battery: number | null
  x: number | null
  y: number | null
  direction: number | null
  currentSite: string | null
  blocked: boolean | null
  charging: boolean | null
  currentMap: string | null
  currentMapMd5: string | null
  alerts?: MrRobotAlert[]
}

declare interface MrRobotAlert {
  level: string
  code: string | null
  message: string
  times: number | null
  timestamp: any
}


declare const wcs: ScriptWcs

declare interface ScriptPlc {
  modbusRead: (tc: TraceContext, deviceName: string, reqMap: ModbusReadReq) => number[]
  /**
   * 重复读，直到等于某个值；无限尝试
   */
  modbusReadUtilEq: (tc: TraceContext, deviceName: string, reqMap: ModbusReadReq, targetValue: number, readDelay: number) => void
  /**
   * 重复读，直到等于某个值；最多尝试指定次数
   */
  modbusReadUtilEqMaxRetry: (tc: TraceContext, deviceName: string, reqMap: ModbusReadReq, targetValue: number, readDelay: number, maxRetry: number) => boolean
  modbusWrite: (tc: TraceContext, deviceName: string, reqMap: ModbusWriteReq, values: number[]) => void

  s7Read: (tc: TraceContext, deviceName: string, reqMap: S7ReadReq) => any
  s7ReadUntilEq: (tc: TraceContext, deviceName: string, reqMap: S7ReadReq, targetValue: any, readDelay: number) => void
  s7Write: (tc: TraceContext, deviceName: string, reqMap: S7WriteReq) => void
}

declare const plc: ScriptPlc

declare interface ModbusReadReq {
  code: number
  address: number
  qty: number
  slaveId?: number
  maxRetry?: number
  retryDelay?: number
}

declare interface ModbusWriteReq {
  code: number
  address: number
  slaveId?: number
  maxRetry?: number
  retryDelay?: number
}

declare interface S7ReadReq {
  blockType: "DB" | "Q" | "I" | "M" | "V"
  dataType: "BOOL" | "BYTE" | "INT16" | "UINT16" | "INT32" | "UINT32" | "FLOAT32" | "FLOAT64" | "STRING"
  dbId: number
  byteOffset: number
  bitOffset?: number
  maxRetry?: number
  retryDelay?: number
}

declare interface S7WriteReq {
  value: any
  blockType: "DB" | "Q" | "I" | "M" | "V"
  dataType: "BOOL" | "BYTE" | "INT16" | "UINT16" | "INT32" | "UINT32" | "FLOAT32" | "FLOAT64" | "STRING"
  dbId: number
  byteOffset: number
  bitOffset?: number
  maxRetry?: number
  retryDelay?: number
}


declare interface ScriptUi {
  /**
   * 在指定工位电脑上，打开业务对象的界面
   */
  openEntityViewPage: (workSite: string, entityName: string, id: string, mode: "Edit" | "Read") => void

}

declare const ui: ScriptUi

// ========
// BZ

declare interface Bz {
  tryCallContainer: (tc: TraceContext) => void
  tryOutbound: (tc: TraceContext) => void
  finishPutOrderByContainer: (tc: TraceContext, containerId: string) => void
  /**
   * 修复并创建库存明细。填充物料信息、位置信息、容器等。
   */
  fixCreateInvLayout: (tc: TraceContext, layouts: MapToAny[]) => void
}

declare const bz: Bz

declare interface OrderLineSource {
  orderId: string
  lineId: string
  lineNo: number
}

declare type ShortOption = "Stop" | "Part"

declare interface CallContainerPlan {
  mixKey: string
  materialId: string
  feature: JavaMap, // 额外的筛选字段
  restQty: number // 待装数量
  assignedQty: number // 实际成功分配的数量
  qty: number, // 入库数
  callContainerQty: number, // 已叫
  sources: OrderLineSource[] // 来源单据单行
}

declare interface MaterialContainerMaxQty {
  containerType: string
  subNum: number
  maxQty: number
}

declare interface ResLock {
  withLock: (action: () => void) => void
  // isLocked: (tc: TraceContext, resType: string, resId: string) => boolean
  // getOwner: (tc: TraceContext, resType: string, resId: string) => string | null
  // tryLockRes: (tc: TraceContext, resType: string, resId: string, owner: string, reason: string) => boolean
  // unlockRes: (tc: TraceContext, resType: string, resId: string) => void
  // unlockResIfLockedBy: (tc: TraceContext, resType: string, resId: string, me: string) => Boolean
  // listMyRes: (tc: TraceContext, me: string) => MapToAny[]
}

declare const resLock: ResLock

declare interface CallEntityExtButtonReq {
  func: string // 调用函数的名字
  entityName: string // 业务对象名
  selectedIds?: string[] | null // 选中的业务对象 ID，用于列表界面
  evId?: string | null // 当前业务对象 ID，用于编辑和查看界面
  ev?: MapToAny | null // 当前业务对象值，用于新增编辑和查看界面
}


declare interface ScriptUtils {
  isNullOrBlank: (str: string | null | undefined) => Boolean
  substringAfter: (str: string, sep: string) => string
  substringBefore: (str: string, sep: string) => string
  splitTrim: (str: string | null | undefined, sep: string) => string[]
  //
  anyToInt: (v: any) => number | null
  anyToLong: (v: any) => number | null
  anyToFloat: (v: any) => number | null
  anyToDouble: (v: any) => number | null
  //
  anyToBool: (a: any) => boolean
  //
  anyToDate: (input: any) => Date
  /**
   * format 是 Java 的格式
   */
  formatDate: (d: Date, format: string) => string
  //
  /**
   * 产生 UUID 字符串
   */
  uuidStr: () => string
  /**
   * 产生 ObjectId 字符串
   */
  oidStr: () => string
}

declare const utils: ScriptUtils

declare interface File {
  /**
   * 文件是否存在
   */
  exists(): boolean

  /**
   * 文件名
   */
  getName(): string

  /**
   * 获取绝对路径
   */
  getAbsolutePath(): string

  /**
   * 长度（字节）
   */
  length(): number
}

declare interface FileUtils {
  /**
   * 将路径字符串转换为 Java 的 File 对象
   */
  strToFile(pathStr: string): File

  /**
   * 将表示目录的字符串和文件名的字符串拼起来，得到 File 对象
   */
  joinDirFile(dir: string, file: string): File

  /**
   * 移动文件
   */
  moveFile(srcFile: File, dstFile: File): void

  /**
   * 移动目录
   */
  moveDirectory(srcDir: File, dstDir: File): void

  /**
   * 删除文件
   */
  removeFile(dir: File): void

  /**
   * 删除目录
   */
  removeDirectory(dir: File): void

  /**
   * 返回 M4 存放文件的默认根目录
   */
  ensureFilesDir(): File

  /**
   * 将路径字符串（相对于 M4 存放文件的默认根目录）转化为 File 对象
   * @param path
   */
  pathToFile(path: string): File


  /**
   * 获取文件相对于“M4 存放文件的默认根目录”的相对路径。数据库和前端存储文件存储的都是这个相对路径。
   * @param file
   */
  fileToPath(file: File): string

  /**
   * 返回 M4 默认临时文件的根目录
   */
  ensureTmpDir(): File

  /**
   * 创建一个临时文件。生成的文件名为 前缀 + UUID + 后缀 + .扩展名
   * @param ext 扩展名，最前面不要有点
   * @param prefix
   * @param suffix
   */
  nextTmpFile(ext: string, prefix: string, suffix: string): File
}

declare const fileUtils: FileUtils

interface ScriptStats {
  /**
   * 添加统计图标组
   */
  addStatsGroup(gStr: string): void

  /**
   * 构造最近 N 天统计需要的参数
   * @param days
   */
  buildLastDaysParams(days: number): LastDaysParams
}

interface LastDaysParams {
  startInstant: any
  endInstant: any
  dates: string[]
}

declare const stats: ScriptStats

function addStatsGroup(g: ChartGroup) {
  stats.addStatsGroup(JSON.stringify(g))
}

const STATS_EXT_PREFIX = "Ext::"

declare interface ChartGroup {
  id: string
  label: string
  displayOrder?: number
  items: ChartItem[]
}

declare interface ChartItem {
  id: string
  label: string
  desc?: string
  displayOrder?: number
}

// =======
// 真实代码

interface ScriptButton {
  label: string
  func: string
  confirmText?: string | null
  callTimeout?: number | null
  inputEntityName?: string | null
  inputMaxWidth?: number | null
}

function setScriptButtons(buttons: ScriptButton[]) {
  const buttonsStr = JSON.stringify(buttons)
  base.setScriptButtons(buttonsStr)
}

interface ScriptButtonResult {
  message?: string | null
}

interface HttpRequest {
  url: string
  method: "Get" | "Post" | "Put" | "Delete"
  contentType: "Json" | "Xml" | "Plain"
  reqBody?: string | null
  headers?: any | null
  basicAuth?: any | null
  trace?: boolean
  traceReqBody?: boolean
  traceResBody?: boolean
  reqOn?: Date
}

interface CallRetryOptions {
  maxRetryNum?: number
  retryDelay?: number
}

declare interface CheckResultResult {
  ok: boolean
}

function httpAsyncCallback(tc: TraceContext, req: HttpRequest, okChecker: string, o?: CallRetryOptions | null): string {
  return httpClient.asyncCallback(tc, JSON.stringify(req), okChecker, (o) ? JSON.stringify(o) : JSON.stringify({}))
}

function httpSyncCall(tc: TraceContext, req: HttpRequest, okChecker: (res: HttpResult) => boolean | null, o?: CallRetryOptions | null): HttpResult {
  return httpClient.syncCall(tc, JSON.stringify(req), okChecker, (o) ? JSON.stringify(o) : JSON.stringify({}))
}