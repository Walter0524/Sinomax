//定时器：更新物料巷道是否停止入库、是否允许出库
function schedulerChangeChannelIOReady() {
    const tc = base.traceContext();
    const allowSeconds = 12 * 60 * 60 * 1000;
    base.scheduledAtFixedDelay("changeChannelIOReady", 2000, counter => {
        const nowTimestamp = new Date().getTime();
        // 根据最内入库时间，修改禁止入库
        // 查找非禁止入库、非禁用的巷道
        const unInStopChannels = entity.findMany(tc, "FbRackChannel", cq.and([cq.ne("inStop", true), cq.ne("material", "EmptyShelves"), cq.ne("disabled", true)]), null);
        if (unInStopChannels && unInStopChannels.length !== 0) {
            for (const channel of unInStopChannels) {
                const channelId = channel.id;
                const firstDate = channel["firstDate"];
                if (!firstDate)
                    continue;
                const firstDateTimestamp = new Date(firstDate).getTime();
                if (nowTimestamp - firstDateTimestamp > allowSeconds) {
                    entity.updateOneById(tc, "FbRackChannel", channelId, { "inStop": true }, null);
                }
            }
        }
        // 根据最外入库时间，修改允许出库
        // 查找禁止入库、非允许出库、非禁用的巷道
        const inStopChannels = entity.findMany(tc, "FbRackChannel", cq.and([cq.ne("outReady", true), cq.eq("inStop", true), cq.ne("material", "EmptyShelves"), cq.ne("disabled", true)]), null);
        if (inStopChannels && inStopChannels.length !== 0) {
            for (const channel of inStopChannels) {
                const channelId = channel.id;
                const lastDate = channel["lastDate"];
                if (!lastDate)
                    continue;
                const lastDateTimestamp = new Date(lastDate).getTime();
                if (nowTimestamp - lastDateTimestamp > allowSeconds) {
                    entity.updateOneById(tc, "FbRackChannel", channelId, { "outReady": true }, null);
                }
            }
        }
    });
}
// 定时器：自动补充空料架缓存区
function schedulerAutoLoadEmptyTemp() {
    const tc = base.traceContext();
    base.scheduledAtFixedDelay("autoLoadEmptyTemp", 2000, counter => {
        // 查找空料架缓存区存在的无锁、未停用的空库位
        const emptyBins = entity.findMany(tc, "FbBin", cq.and([cq.eq("district", "ETS"), cq.ne("locked", true), cq.ne("btDisabled", true), cq.ne("occupied", true)]), null);
        if (!emptyBins || emptyBins.length === 0)
            return;
        for (const emptyBin of emptyBins) {
            const toBinId = emptyBin.id;
            entity.updateOneById(tc, "FbBin", toBinId, { locked: true }, null);
            const params = {
                status: "Created",
                kind: "AutoLoadEmptyTemp",
                container: "",
                fromBin: "",
                toBin: toBinId,
                robotName: "",
                sourceOrderId: "schedulerAutoLoadEmptyTemp",
                remark: "",
                falconTaskDefId: "676A762491CEBD39B53E6044",
                falconTaskDefLabel: "AutoLoadEmptyTemp"
            };
            createContainerTransportOrder(tc, params);
            thread.sleep(1000);
        }
    });
}
// 定时器：自动触发补 A 产线空料架与等待入库的合并任务
function schedulerAutoLoadEmptyStackerAndWaitForInBoundA() {
    base.scheduledAtFixedDelay("autoLoadEmptyStackerAndWaitForInBoundA", 2000, counter => {
        const tc = base.traceContext();
        const line = "A";
        // A 产线是否开启
        autoLoadEmptyStackerAndWaitForInBound(tc, line);
    });
}
// 定时器：自动触发补 A 产线空料架与等待入库的合并任务
function schedulerAutoLoadEmptyStackerAndWaitForInBoundB() {
    base.scheduledAtFixedDelay("autoLoadEmptyStackerAndWaitForInBoundB", 2000, counter => {
        const tc = base.traceContext();
        const line = "B";
        // A 产线是否开启
        autoLoadEmptyStackerAndWaitForInBound(tc, line);
    });
}
function autoLoadEmptyStackerAndWaitForInBound(tc, line) {
    // 判断产线是否开启，不是开启状态则停止
    const status = plc.modbusRead(tc, LINE_PLC_CONFIG[line]["plcName"], { address: LINE_PLC_CONFIG[line]["statusAddr"], qty: 1, code: 0x03, slaveId: LINE_PLC_CONFIG[line]["slaveId"] })[0];
    if (status != LINE_PLC_CONFIG[line]["stoped"])
        return;
    // 如果是产线 B ，判断是否是入库状态，非入库状态则停止
    if (line == "B") {
        if (status == LINE_PLC_CONFIG["B"]["outbound"])
            return;
    }
    // 判断对应的缓存点是否未锁定，锁定则停止
    const tempBinId = LINE_TEMP_CONFIG[line]["tempBin"];
    const unlockedTempBin = entity.findOne(tc, "FbBin", cq.and([cq.idEq(tempBinId), cq.ne("locked", true)]), null);
    if (!unlockedTempBin)
        return;
    // 满足触发条件，锁定缓存点（终点），并创建容器搬运单
    entity.updateOneById(tc, "FbBin", tempBinId, { "locked": true }, null);
    const params = {
        status: "Created",
        kind: "AutoLoadEmptyStackerAndWaitForInBound",
        container: "",
        fromBin: "",
        toBin: tempBinId,
        robotName: "",
        sourceOrderId: "schedulerAutoLoadEmptyStackerAndWaitForInBound",
        remark: "",
        falconTaskDefId: "6772434D39F1467A5DF60BF5",
        falconTaskDefLabel: "LoadStackerWaitForInBound"
    };
    createContainerTransportOrder(tc, params);
}
// 定时器：自动触发【物料出库 OutboundOrder】搬运任务
function schedulerAutoStartStackerOutbound() {
    base.scheduledAtFixedDelay("autoStartStackerOutbound", 1000, counter => {
        const tc = base.traceContext();
        const line = "B";
        const plcName = LINE_PLC_CONFIG[line]["plcName"];
        const slaveId = LINE_PLC_CONFIG[line]["slaveId"];
        const statusAddr = LINE_PLC_CONFIG[line]["statusAddr"];
        // 检查 B 产线状态是否为出库状态，否则终止
        const status = plc.modbusRead(tc, plcName, { address: statusAddr, qty: 1, code: 0x03, slaveId: slaveId })[0];
        if (status != LINE_PLC_CONFIG[line]["outbound"]) {
            return;
        }
        //按时间从小到大按顺序查找已提交的物料出库单
        const oo = entity.buildFindOptions(null, ["createdOn"], null, null);
        const committedOutboundOrder = entity.findOne(tc, "OutboundOrder", cq.and([cq.eq("btOrderState", "Committed")]), oo);
        // 没有已提交的物料出库单则终止
        if (!committedOutboundOrder)
            return;
        // 有物料出库单但暂无单行则终止
        const committedOutboundOrderBtLines = committedOutboundOrder["btLines"];
        if (!committedOutboundOrderBtLines || committedOutboundOrderBtLines.length == 0)
            return;
        // 获取出库单 id
        const committedOutboundOrderId = committedOutboundOrder.id;
        // 按时间从小到大按顺序查找未提交的物料出库单行
        const olo = entity.buildFindOptions(null, ["btLineNo"], null, null);
        const initOutboundOrderLines = entity.findMany(tc, "OutboundOrderLines", cq.and([cq.eq("btParentId", committedOutboundOrderId), cq.eq("status", "Init")]), olo);
        // 如果找不到已提交出库单的待办物料未提交出库单行，将出库单更新为已完成并终止
        if (!initOutboundOrderLines || initOutboundOrderLines.length == 0) {
            entity.updateOneById(tc, "OutboundOrder", committedOutboundOrderId, { "btOrderState": "Done" }, null);
            return;
        }
        // 如果正在出库的出库单行 >= 2，则终止
        const commitedOutboundOrderLines = entity.findMany(tc, "OutboundOrderLines", cq.and([cq.eq("btParentId", committedOutboundOrderId), cq.eq("status", "Commited")]), olo);
        if (commitedOutboundOrderLines && commitedOutboundOrderLines.length >= 2) {
            return;
        }
        // 以上校验全部通过，按顺序提交一个待执行的出库单单行
        const initOutboundOrderLine = entity.findOne(tc, "OutboundOrderLines", cq.and([cq.eq("btParentId", committedOutboundOrderId), cq.eq("status", "Init")]), olo);
        const btLineNo = initOutboundOrderLine.btLineNo;
        const fromBin = initOutboundOrderLine.bin;
        const container = initOutboundOrderLine.container;
        const toBin = LINE_TEMP_CONFIG[line]["lineBin"];
        const params = {
            status: "Created",
            kind: "StackerOutbound",
            container: container,
            fromBin: fromBin,
            toBin: toBin,
            robotName: "",
            sourceOrderId: committedOutboundOrderId,
            sourceOrderLineNo: btLineNo,
            remark: "",
            falconTaskDefId: "67737CC739F1467A5DF743C0",
            falconTaskDefLabel: "StackerOutbound"
        };
        createContainerTransportOrder(tc, params);
        entity.updateOneById(tc, "OutboundOrderLines", initOutboundOrderLine.id, { status: "Commited" }, null);
    });
}
// 定时器：自动触发【自动线物料出库 ManualOutboundOrder】搬运任务
function schedulerAutoStartManualOutbound() {
    base.scheduledAtFixedDelay("autoStartManualOutbound", 1000, counter => {
        const tc = base.traceContext();
        const toBin = "CO";
        //按时间从小到大按顺序查找已提交的物料出库单
        const oo = entity.buildFindOptions(null, ["createdOn"], null, null);
        const committedOutboundOrder = entity.findOne(tc, "ManualOutboundOrder", cq.and([cq.eq("btOrderState", "Committed")]), oo);
        // 没有已提交的物料出库单则终止
        if (!committedOutboundOrder)
            return;
        // 有物料出库单但暂无单行则终止
        const committedOutboundOrderBtLines = committedOutboundOrder["btLines"];
        if (!committedOutboundOrderBtLines || committedOutboundOrderBtLines.length == 0)
            return;
        // 获取出库单 id
        const committedOutboundOrderId = committedOutboundOrder.id;
        // 按时间从小到大按顺序查找未提交的物料出库单行
        const olo = entity.buildFindOptions(null, ["btLineNo"], null, null);
        const initOutboundOrderLines = entity.findMany(tc, "ManualOutboundOrderLines", cq.and([cq.eq("btParentId", committedOutboundOrderId), cq.eq("status", "Init")]), olo);
        // 如果找不到已提交出库单的待办物料未提交出库单行，将出库单更新为已完成并终止
        if (!initOutboundOrderLines || initOutboundOrderLines.length == 0) {
            entity.updateOneById(tc, "ManualOutboundOrder", committedOutboundOrderId, { "btOrderState": "Done" }, null);
            return;
        }
        // 如果正在出库的出库单行 >= 4，则终止
        const commitedOutboundOrderLines = entity.findMany(tc, "ManualOutboundOrderLines", cq.and([cq.eq("btParentId", committedOutboundOrderId), cq.eq("status", "Commited")]), olo);
        if (commitedOutboundOrderLines && commitedOutboundOrderLines.length >= 4) {
            return;
        }
        // 以上校验全部通过，按顺序提交一个待执行的出库单单行
        const initOutboundOrderLine = entity.findOne(tc, "ManualOutboundOrderLines", cq.and([cq.eq("btParentId", committedOutboundOrderId), cq.eq("status", "Init")]), olo);
        const btLineNo = initOutboundOrderLine.btLineNo;
        const fromBin = initOutboundOrderLine.bin;
        const container = initOutboundOrderLine.container;
        const params = {
            status: "Created",
            kind: "ManualOutbound",
            container: container,
            fromBin: fromBin,
            toBin: toBin,
            robotName: "",
            sourceOrderId: committedOutboundOrderId,
            sourceOrderLineNo: btLineNo,
            remark: "",
            falconTaskDefId: "67737CC739F1467A5DF743C0",
            falconTaskDefLabel: "ManualOutbound"
        };
        createContainerTransportOrder(tc, params);
        entity.updateOneById(tc, "ManualOutboundOrderLines", initOutboundOrderLine.id, { status: "Commited" }, null);
    });
}
