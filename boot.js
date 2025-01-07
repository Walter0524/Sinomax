function boot() {
    const tc = base.traceContext();
    base.logInfo(tc, "进入脚本启动函数");
    setScriptButtons([
        { label: "测试寻空库位", func: "test", confirmText: "确定要看吗？" }
    ]);
    //初始化 AB 产线呼叫物料入库全局变量、入库单 ID 全局变量
    base.setGlobalValue(LINE_INBOUND_CONFIG["A"]["askInboundGlobalValue"], false);
    base.setGlobalValue(LINE_INBOUND_CONFIG["A"]["inboundOrderIdGlobalValue"], "");
    base.setGlobalValue(LINE_INBOUND_CONFIG["B"]["askInboundGlobalValue"], false);
    base.setGlobalValue(LINE_INBOUND_CONFIG["B"]["inboundOrderIdGlobalValue"], "");
    //初始化 C 人工线出库全局变量
    base.setGlobalValue(MANUALLINE_CONFIG["askEmptyShelvesBackGlobalValue"], false);
    //创建定时器线程：更新物料巷道是否停止入库、是否允许出库
    thread.createThread("ChangeChannelIOReady", "schedulerChangeChannelIOReady");
    //创建定时器线程：自动补充空料架缓存区
    thread.createThread("AutoLoadEmptyTemp", "schedulerAutoLoadEmptyTemp");
    //创建定时器线程：自动触发补 A and B 产线空料架与等待入库的合并任务
    thread.createThread("AutoLoadEmptyStackerAndWaitForInBoundA", "schedulerAutoLoadEmptyStackerAndWaitForInBoundA");
    thread.createThread("AutoLoadEmptyStackerAndWaitForInBoundB", "schedulerAutoLoadEmptyStackerAndWaitForInBoundB");
    //创建实体拦截器：【自动线物料入库】创建前根据用户 ID 判断起点库位，并设置请求入库与入库单号的全局变量
    entityExt.extBeforeCreating("InboundOrder", "decideFromBinByUserBeforeCreating");
    //创建实体拦截器：【自动线物料出库】创建前寻找库存并修改单头单行，找不到可出的前端报错
    entityExt.extBeforeCreating("OutboundOrder", "findInvBeforeOutboundOrderCreating");
    entityExt.extAfterCreating("OutboundOrder", "buildBtLinesAfterOutboundOrderCreating");
    //创建定时器线程：自动触发【自动线物料出库 OutboundOrder】搬运任务
    thread.createThread("AutoStartStackerOutbound", "schedulerAutoStartStackerOutbound");
    //创建实体拦截器：【人工线物料出库】创建前寻找库存并修改单头单行，找不到可出的前端报错
    entityExt.extBeforeCreating("ManualOutboundOrder", "findInvBeforeOutboundOrderCreating");
    entityExt.extAfterCreating("ManualOutboundOrder", "buildBtLinesAfterOutboundOrderCreating");
    //创建定时器线程：自动触发【自动线物料出库 ManualOutboundOrder】搬运任务
    thread.createThread("AutoStartManualOutbound", "schedulerAutoStartManualOutbound");
}
// 创建容器搬运单
function createContainerTransportOrder(tc, params) {
    const order = {
        status: params["status"],
        kind: params["falconTaskDefLabel"],
        container: params["container"],
        fromBin: params["fromBin"],
        toBin: params["toBin"],
        robotName: "",
        sourceOrderId: params["sourceOrderId"],
        sourceOrderLineNo: params["sourceOrderLineNo"],
        remark: "",
        falconTaskDefId: params["falconTaskDefId"],
        falconTaskDefLabel: params["falconTaskDefLabel"]
    };
    const CTO = entity.createOne(tc, "ContainerTransportOrder", order, null);
    return CTO;
}
// 格式化时间戳
function formatTimeStamp(timestamp) {
    const date = new Date(timestamp);
    // 获取年、月、日、时、分
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
// C 人工线下架一托，允许空料架回库
function cAskEmptyShelvesBack(tc, params) {
    base.setGlobalValue(MANUALLINE_CONFIG["askEmptyShelvesBackGlobalValue"], true);
    return base.jsonToString({ "outputParams": { "error": false } });
}
