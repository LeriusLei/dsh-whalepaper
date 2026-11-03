# 色光与动作参考记录

## 实际检查的素材

| 来源 | 检查内容 | 应用 |
| --- | --- | --- |
| [NOAA：虎鲸航拍视频](https://videos.fisheries.noaa.gov/detail/videos/dolphins-porpoises/video/3812337968001/unmanned-aerial-vehicle-offers-a-new-view-of-killer-whales) | 视频全长约11分钟；抽查多个片段，并逐帧比较60–67秒的出水、尾部推进与再次下潜 | 前向弧线路径、跟随躯干的尾柄、短促出水与尾迹，不使用垂直升降电梯 |
| [NOAA：Killer Whale Anatomy](https://oceantoday.noaa.gov/killerwhaleanatomy/) | 视频/文字的尾柄、尾叶、胸鳍和呼吸孔说明 | 尾叶上下推进；胸鳍转向、减速与改变迎角；真实呼吸孔位置 |
| [Wright等，2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC5319153/) | 捕食时的深度、速度、转动，以及猎物的逃逸 | 渐进加速、预测追逐、下潜逃离、嘴部实际接触才捕获 |
| [Raincoast：A55侧卧行为](https://www.raincoast.org/2025/04/a55-nothern-resident-popular-video/) | 研究机构对视频中侧卧、停顿后继续游动的解释 | 日常多数翻滚改为缓慢侧倾、短暂停顿、回正；完整翻滚更少发生。没有把机构对行为动机的解释当作唯一事实 |
| [Academy：Deconstructing Pi](https://www.oscars.org/events/deconstructing-pi-reveals-bold-new-perspective-oscar-winning-epic) | 对不同太阳角度、分层低光和克制的3D表现的记录 | 八时段分别调太阳高度、云底、海面反射和水下明暗，减少反复的戏剧性跃出 |
| [Life of Pi官方预告](https://www.youtube.com/watch?v=zoA-1gFmOIM)与公开剧照 | 搜索白昼、金色海面和生物荧光夜景；本地实际查看金色海面与夜景图片 | 暖高光 / 冷海水、天空实际倒影、夜景里集中而稀疏的亮点。预告链接是参考入口，不声称浏览器完整播放验证 |
| [Kingdom Two Crowns官方画廊](https://kingdomthegame.com/kingdom-two-crowns/) | 实际查看官方发布的环境截图 | 分层远岸、微小暖灯、镜面与碎裂反光、边缘的低对比前景，不复制游戏建筑或角色 |

电影剧照参考入口：[金色海面](https://www.bluscreens.net/life-of-pi.html)、[夜间海面](https://www.wearemoviegeeks.com/2013/04/the-academy-delves-into-the-visual-effects-recipe-for-life-of-pi/lop-068-pi-patel-takes-in-the-bioluminescent-wonders-of-the-sea/)。这些素材只用于分析，未进入发布包。新增环境全部由本项目的Canvas代码产生。

## 实现取舍

1. 这是同一个侧视水族空间，不把空中或水中的任意屏幕坐标当作喷水源。呼吸、捕获、入水事件都读取实际变形后的几何位置。
2. 推进、转向和体态属于同一个运动过程。有限角速度先改变朝向，水阻逐渐改变动量；脊柱随后传递方向变化，尾柄叠加推进波。没有独立的目标高度推进器。
3. 近水面通过控制俯仰逐步放平，不让一个水平身体竖直抬升。入水后先消退角动量，再回到缓慢巡游。
4. 比例没有唯一美学答案。28%水上保留主体尺度，33%给云层更多空间，38.2%突出远空。黄金分割作为可比较构图，不作为“必然更美”的规则。
5. 八版共享几何与云层构成，分别调整云光、光源高度、反射、深水与星光。自动模式在色光锚点之间平滑变化，固定版本便于比较。
6. 夜间局部微光是电影美术启发；它不是对虎鲸发光或特定海域生态的科学描述。行为时间也经过安静壁纸的艺术处理。

本轮采用 ui-ux-pro-max 的单一主体、层次与克制原则，以及 web-animation-design 的连续性、阻尼、减少动态效果与性能实践。长时间动物运动按体态与动力耦合处理，不套用按钮动画的毫秒时长。
