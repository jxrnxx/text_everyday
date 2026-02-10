import { type FC, useState, useEffect } from 'react';

// ===== NPC 头顶悬浮牌匾配置 =====
// unitName -> 显示名称
const NPC_OVERHEAD_CONFIG: Record<string, string> = {
    npc_cultivation_merchant: '修炼商人',
    npc_ability_merchant: '技能商人',
};

// ===== 单个 NPC 头顶牌匾 =====
interface OverheadProps {
    entityIndex: EntityIndex;
    title: string;
    offsetZ?: number;
}

const NPCOverheadPlaque: FC<OverheadProps> = ({ entityIndex, title, offsetZ = 250 }) => {
    const [screenX, setScreenX] = useState(-1);
    const [screenY, setScreenY] = useState(-1);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const track = () => {
            // @ts-ignore
            if (!Entities.IsAlive(entityIndex)) {
                setVisible(false);
                $.Schedule(0.5, track);
                return;
            }

            // @ts-ignore
            const origin = Entities.GetAbsOrigin(entityIndex);
            if (!origin) {
                setVisible(false);
                $.Schedule(0.1, track);
                return;
            }

            const worldX = origin[0];
            const worldY = origin[1];
            const worldZ = origin[2] + offsetZ;

            const sx = Game.WorldToScreenX(worldX, worldY, worldZ);
            const sy = Game.WorldToScreenY(worldX, worldY, worldZ);

            if (sx === -1 || sy === -1) {
                setVisible(false);
            } else {
                // WorldToScreen 返回 0~1 的归一化值，转为实际像素
                const actualX = sx * Game.GetScreenWidth();
                const actualY = sy * Game.GetScreenHeight();
                setScreenX(actualX);
                setScreenY(actualY);
                setVisible(true);
            }

            $.Schedule(0.02, track); // ~50fps 刷新
        };

        track();
    }, [entityIndex, offsetZ]);

    if (!visible) return null;

    return (
        <Panel
            className="NPCOverheadRoot"
            style={{
                position: `${screenX}px ${screenY}px 0px` as any,
            }}
        >
            <Panel className="NPCOverheadPlaque">
                {/* 左侧云纹装饰 */}
                <Panel className="NPCOverheadOrnamentLeft" />
                {/* 文字 */}
                <Label className="NPCOverheadTitle" text={title} />
                {/* 右侧云纹装饰 */}
                <Panel className="NPCOverheadOrnamentRight" />
            </Panel>
            {/* 向下指示箭头 */}
            <Panel className="NPCOverheadArrow" />
        </Panel>
    );
};

// ===== NPC 头顶管理器 =====
const NPCOverheadManager: FC = () => {
    const [npcs, setNpcs] = useState<Array<{ entityIndex: EntityIndex; title: string }>>([]);

    useEffect(() => {
        const scan = () => {
            const found: Array<{ entityIndex: EntityIndex; title: string }> = [];

            for (const [unitName, displayTitle] of Object.entries(NPC_OVERHEAD_CONFIG)) {
                // @ts-ignore
                let ent = Entities.First();
                while (ent !== undefined && ent !== -1) {
                    // @ts-ignore
                    const name = Entities.GetUnitName(ent);
                    // @ts-ignore
                    const alive = Entities.IsAlive(ent);
                    if (name === unitName && alive) {
                        if (!found.some(f => f.entityIndex === ent)) {
                            found.push({ entityIndex: ent, title: displayTitle });
                        }
                    }
                    // @ts-ignore
                    ent = Entities.Next(ent);
                }
            }

            setNpcs(found);
            $.Schedule(1.0, scan);
        };

        // 延迟启动，等待游戏加载
        $.Schedule(3.0, scan);
    }, []);

    return (
        <>
            {npcs.map(npc => (
                <NPCOverheadPlaque
                    key={String(npc.entityIndex)}
                    entityIndex={npc.entityIndex}
                    title={npc.title}
                />
            ))}
        </>
    );
};

export default NPCOverheadManager;
