
function boot() {
    const tc = base.traceContext()
    base.logInfo(tc, "进入脚本启动函数")
    setScriptButtons([
        {label: "测试寻空库位", func: "test", confirmText: "确定要看吗？"},

    ])
    //呼叫空料架 A\B 的全局变量
    base.setGlobalValue("aaa", 0)
    base.setGlobalValue("bbb", 0)
    //创建线程：呼叫空料架定时器
    thread.createThread("PlatformRecycleTempAddEmptyPallet", "schedulerModbus")

    //创建线程：更新巷道是否允许出库
    thread.createThread("ChangeChannelIoReady", "schedulerChangeChannelIoReady")

    //创建实体拦截器：【物料入库】创建前根据用户 ID 判断起点库位
    entityExt.extBeforeCreating("InboundOrder","decideFromBinByUserBeforeCreating")

    //创建实体拦截器：【物料出库】创建前寻找库存并修改单头单行，找不到可出的前端报错
    entityExt.extBeforeCreating("OutboundOrder","findInvAndBuildLinesBeforeCreating")
}


function test() {
    const tc = base.traceContext()
    let options = entity.buildFindOptions(null, ["-createdOn"], null, 1)
    let ftr = entity.findOne(tc, "FalconTaskRecord",
        cq.and([cq.eq("defLabel", "码垛位A呼叫空托盘"),
            cq.or([cq.eq("status", 160), cq.eq("status", 180)])]), options)
    console.log(ftr);
    return JSON.stringify({message: "1.1.3"})
}


