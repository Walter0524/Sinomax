//定时器：更新巷道是否允许出库
function schedulerChangeChannelIoReady() {
    base.scheduledAtFixedDelay("changeChannelIoReady", 2000, counter => {
        const tc = base.traceContext();
        const channels = entity.findMany(tc, "FbRackChannel", cq.and([cq.ne("ioReady", true), cq.ne("ioState", "入"), cq.ne("ioState", "出"), cq.ne("disabled", true)]), null);
        if (!channels || channels.length === 0)
            return;
        for (const channel of channels) {
            const channelId = channel.id;
            const ioDate = channel["ioDate"];
            if (!ioDate)
                continue;
            const ioDateTimestamp = new Date(ioDate).getTime();
            const nowTimestamp = new Date().getTime();
            if (nowTimestamp - ioDateTimestamp > 12 * 60 * 60 * 1000 || channel["material"] === "EMPTY") {
                entity.updateOneById(tc, "FbRackChannel", channelId, { "ioReady": true }, null);
            }
        }
    });
}
