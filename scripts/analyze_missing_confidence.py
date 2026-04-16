#!/usr/bin/env python3
"""分析缺失置信度的人物并生成补充数据"""

# 已有置信度的人物
EXISTING_CONFIDENCE = {
    'jiqun', 'charlie-munger', 'paul-graham', 'marcus-aurelius', 'epictetus',
    'naval', 'elon-musk', 'alan-watts', 'peter-thiel', 'richard-feynman',
    'ray-dalio', 'sam-altman', 'jeff-bezos', 'jensen-huang', 'jerome-powell',
    'trump', 'confucius', 'lao-zi', 'seneca', 'warren-buffett',
    'kant', 'cao-cao', 'tesla-nikola', 'einstein', 'steve-jobs',
    'zhuge-liang', 'zhang-yiming', 'zhang-xuefeng', 'mrbeast', 'sun-tzu',
    'zhuang-zi', 'mencius', 'mo-zi', 'han-fei-zi', 'qu-yuan',
    'liu-bei', 'xiang-yu', 'hui-neng', 'qian-xuesen', 'andrej-karpathy',
    'naval-ravikant', 'nikola-tesla', 'ilya-sutskever', 'nassim-taleb', 'donald-trump',
    'sun-wukong', 'zhu-bajie', 'journey-west', 'three-kingdoms', 'records-grand-historian',
    'tripitaka', 'huangdi-neijing'
}

# 已知人物（非心智模型），按领域分类
KNOWN_PERSONAS = {
    # 科技/商业
    'steve-jobs': {'domain': 'technology', 'name': 'Steve Jobs', 'nameZh': '史蒂夫·乔布斯'},
    'elon-musk': {'domain': 'technology', 'name': 'Elon Musk', 'nameZh': '埃隆·马斯克'},
    'jeff-bezos': {'domain': 'investment', 'name': 'Jeff Bezos', 'nameZh': '杰夫·贝索斯'},
    'sam-altman': {'domain': 'technology', 'name': 'Sam Altman', 'nameZh': '山姆·奥特曼'},
    'jensen-huang': {'domain': 'technology', 'name': 'Jensen Huang', 'nameZh': '黄仁勋'},
    'jack-ma': {'domain': 'business', 'name': 'Jack Ma', 'nameZh': '马云'},
    'zhang-yiming': {'domain': 'technology', 'name': 'Zhang Yiming', 'nameZh': '张一鸣'},
    'alan-turing': {'domain': 'science', 'name': 'Alan Turing', 'nameZh': '艾伦·图灵'},
    'andrej-karpathy': {'domain': 'technology', 'name': 'Andrej Karpathy', 'nameZh': '安德烈·卡帕西'},
    'ilya-sutskever': {'domain': 'technology', 'name': 'Ilya Sutskever', 'nameZh': '伊利亚·苏茨克维'},
    
    # 哲学/思想
    'confucius': {'domain': 'philosophy', 'name': 'Confucius', 'nameZh': '孔子'},
    'lao-zi': {'domain': 'philosophy', 'name': 'Lao Tzu', 'nameZh': '老子'},
    'zhuang-zi': {'domain': 'philosophy', 'name': 'Zhuangzi', 'nameZh': '庄子'},
    'mencius': {'domain': 'philosophy', 'name': 'Mencius', 'nameZh': '孟子'},
    'mo-zi': {'domain': 'philosophy', 'name': 'Mozi', 'nameZh': '墨子'},
    'han-fei-zi': {'domain': 'philosophy', 'name': 'Han Feizi', 'nameZh': '韩非子'},
    'kant': {'domain': 'philosophy', 'name': 'Immanuel Kant', 'nameZh': '伊曼努尔·康德'},
    'socrates': {'domain': 'philosophy', 'name': 'Socrates', 'nameZh': '苏格拉底'},
    'jiqun': {'domain': 'philosophy', 'name': 'Ji Qun', 'nameZh': '济群法师'},
    'alan-watts': {'domain': 'philosophy', 'name': 'Alan Watts', 'nameZh': '艾伦·沃茨'},
    'nassim-taleb': {'domain': 'philosophy', 'name': 'Nassim Taleb', 'nameZh': '纳西姆·塔勒布'},
    'lin-yutang': {'domain': 'philosophy', 'name': 'Lin Yutang', 'nameZh': '林语堂'},
    'sima-qian': {'domain': 'philosophy', 'name': 'Sima Qian', 'nameZh': '司马迁'},
    'carl-jung': {'domain': 'psychology', 'name': 'Carl Jung', 'nameZh': '卡尔·荣格'},
    'john-dee': {'domain': 'philosophy', 'name': 'John Dee', 'nameZh': '约翰·迪伊'},
    
    # 历史人物
    'sun-tzu': {'domain': 'strategy', 'name': 'Sun Tzu', 'nameZh': '孙子'},
    'marcus-aurelius': {'domain': 'philosophy', 'name': 'Marcus Aurelius', 'nameZh': '马可·奥勒留'},
    'epictetus': {'domain': 'philosophy', 'name': 'Epictetus', 'nameZh': '爱比克泰德'},
    'seneca': {'domain': 'philosophy', 'name': 'Seneca', 'nameZh': '塞涅卡'},
    'cao-cao': {'domain': 'strategy', 'name': 'Cao Cao', 'nameZh': '曹操'},
    'zhuge-liang': {'domain': 'strategy', 'name': 'Zhuge Liang', 'nameZh': '诸葛亮'},
    'liu-bei': {'domain': 'strategy', 'name': 'Liu Bei', 'nameZh': '刘备'},
    'xiang-yu': {'domain': 'strategy', 'name': 'Xiang Yu', 'nameZh': '项羽'},
    'qu-yuan': {'domain': 'philosophy', 'name': 'Qu Yuan', 'nameZh': '屈原'},
    'hui-neng': {'domain': 'philosophy', 'name': 'Hui Neng', 'nameZh': '惠能'},
    
    # 科学
    'richard-feynman': {'domain': 'science', 'name': 'Richard Feynman', 'nameZh': '理查德·费曼'},
    'einstein': {'domain': 'science', 'name': 'Albert Einstein', 'nameZh': '阿尔伯特·爱因斯坦'},
    'qian-xuesen': {'domain': 'science', 'name': 'Qian Xuesen', 'nameZh': '钱学森'},
    'nikola-tesla': {'domain': 'science', 'name': 'Nikola Tesla', 'nameZh': '尼古拉·特斯拉'},
    
    # 投资
    'warren-buffett': {'domain': 'investment', 'name': 'Warren Buffett', 'nameZh': '沃伦·巴菲特'},
    'charlie-munger': {'domain': 'investment', 'name': 'Charlie Munger', 'nameZh': '查理·芒格'},
    'ray-dalio': {'domain': 'investment', 'name': 'Ray Dalio', 'nameZh': '雷·达里奥'},
    'peter-thiel': {'domain': 'investment', 'name': 'Peter Thiel', 'nameZh': '彼得·蒂尔'},
    'paul-graham': {'domain': 'investment', 'name': 'Paul Graham', 'nameZh': '保罗·格雷厄姆'},
    'naval': {'domain': 'investment', 'name': 'Naval Ravikant', 'nameZh': '纳瓦尔·拉威康特'},
    'naval-ravikant': {'domain': 'investment', 'name': 'Naval Ravikant', 'nameZh': '纳瓦尔·拉威康特'},
    'jerome-powell': {'domain': 'investment', 'name': 'Jerome Powell', 'nameZh': '杰罗姆·鲍威尔'},
    'john-maynard-keynes': {'domain': 'investment', 'name': 'John Maynard Keynes', 'nameZh': '约翰·梅纳德·凯恩斯'},
    
    # 政治/公众人物
    'trump': {'domain': 'politics', 'name': 'Donald Trump', 'nameZh': '唐纳德·特朗普'},
    'donald-trump': {'domain': 'politics', 'name': 'Donald Trump', 'nameZh': '唐纳德·特朗普'},
    
    # 娱乐/网红
    'mrbeast': {'domain': 'creativity', 'name': 'MrBeast', 'nameZh': 'MrBeast'},
    
    # 文学/虚构
    'sun-wukong': {'domain': 'creativity', 'name': 'Sun Wukong', 'nameZh': '孙悟空'},
    'zhu-bajie': {'domain': 'creativity', 'name': 'Zhu Bajie', 'nameZh': '猪八戒'},
    'osamu-dazai': {'domain': 'philosophy', 'name': 'Osamu Dazai', 'nameZh': '太宰治'},
    
    # 合集/典籍
    'journey-west': {'domain': 'philosophy', 'name': 'Journey to the West', 'nameZh': '西游记'},
    'three-kingdoms': {'domain': 'history', 'name': 'Three Kingdoms', 'nameZh': '三国演义'},
    'records-grand-historian': {'domain': 'history', 'name': 'Records of the Grand Historian', 'nameZh': '史记'},
    'tripitaka': {'domain': 'philosophy', 'name': 'Tripitaka', 'nameZh': '玄奘'},
    'huangdi-neijing': {'domain': 'philosophy', 'name': 'Huangdi Neijing', 'nameZh': '黄帝内经'},
}

# 需要补充的人物（按领域和优先级估算置信度）
MISSING_PERSONAS = {
    # 高优先级（知名人物，语料丰富）
    'jack-ma': {
        'overall': 68,
        'dataCoverage': 70,
        'rawMaterial': 75,
        'timeSpan': 60,
        'contentDiversity': 70,
        'sourceVerifiability': 65,
        'starRating': 3,
        'version': '1.0',
        'priority': 'high',
        'dataSources': [
            {'type': '公开演讲', 'source': '阿里巴巴/湖畔大学', 'quantity': '数十场', 'quality': '4'},
            {'type': '微博/博客', 'source': '网络归档', 'quantity': '数百条', 'quality': '3'},
            {'type': '采访记录', 'source': '国内外媒体', 'quantity': '数十篇', 'quality': '3'},
        ],
        'mainGaps': ['内部会议记录未获取', '早年创业经历语料不足'],
    },
    'alan-turing': {
        'overall': 72,
        'dataCoverage': 75,
        'rawMaterial': 80,
        'timeSpan': 85,
        'contentDiversity': 65,
        'sourceVerifiability': 80,
        'starRating': 4,
        'version': '1.0',
        'priority': 'medium',
        'dataSources': [
            {'type': '论文著作', 'source': '古登堡计划/学术数据库', 'quantity': '全量', 'quality': '5'},
            {'type': '传记', 'source': 'Alan Turing: The Enigma', 'quantity': '全量', 'quality': '4'},
        ],
        'mainGaps': ['私人书信未全量覆盖'],
    },
    'socrates': {
        'overall': 70,
        'dataCoverage': 65,
        'rawMaterial': 60,
        'timeSpan': 95,
        'contentDiversity': 55,
        'sourceVerifiability': 70,
        'starRating': 3,
        'version': '1.0',
        'priority': 'medium',
        'dataSources': [
            {'type': '柏拉图对话录', 'source': '古登堡计划', 'quantity': '全量', 'quality': '5'},
            {'type': '色诺芬著作', 'source': '古登堡计划', 'quantity': '部分', 'quality': '4'},
        ],
        'mainGaps': ['苏格拉底本人无著作，通过弟子记录'],
    },
    'carl-jung': {
        'overall': 75,
        'dataCoverage': 78,
        'rawMaterial': 80,
        'timeSpan': 90,
        'contentDiversity': 72,
        'sourceVerifiability': 78,
        'starRating': 4,
        'version': '1.0',
        'priority': 'medium',
        'dataSources': [
            {'type': '著作', 'source': 'Collected Works', 'quantity': '全量', 'quality': '5'},
            {'type': '红书', 'source': '公开出版', 'quantity': '全量', 'quality': '5'},
        ],
        'mainGaps': ['分析未发表部分'],
    },
    'lin-yutang': {
        'overall': 70,
        'dataCoverage': 72,
        'rawMaterial': 75,
        'timeSpan': 85,
        'contentDiversity': 68,
        'sourceVerifiability': 72,
        'starRating': 3,
        'version': '1.0',
        'priority': 'medium',
        'dataSources': [
            {'type': '中文著作', 'source': '中华经典古籍库/公开出版物', 'quantity': '主要作品', 'quality': '4'},
            {'type': '英文著作', 'source': '公开出版物', 'quantity': '全量', 'quality': '4'},
        ],
        'mainGaps': ['部分早期作品未覆盖'],
    },
    'sima-qian': {
        'overall': 75,
        'dataCoverage': 80,
        'rawMaterial': 78,
        'timeSpan': 95,
        'contentDiversity': 70,
        'sourceVerifiability': 78,
        'starRating': 4,
        'version': '1.0',
        'priority': 'low',
        'dataSources': [
            {'type': '史记', 'source': '中华经典古籍库', 'quantity': '本纪12+世家30+列传70+表8+书8', 'quality': '5'},
        ],
        'mainGaps': ['早期散佚部分'],
    },
    'john-dee': {
        'overall': 45,
        'dataCoverage': 40,
        'rawMaterial': 35,
        'timeSpan': 75,
        'contentDiversity': 45,
        'sourceVerifiability': 50,
        'starRating': 1,
        'version': '1.0',
        'priority': 'low',
        'dataSources': [
            {'type': '日记/通信', 'source': '网络档案', 'quantity': '部分', 'quality': '3'},
        ],
        'mainGaps': ['原始文献获取困难'],
    },
    'john-maynard-keynes': {
        'overall': 65,
        'dataCoverage': 68,
        'rawMaterial': 72,
        'timeSpan': 90,
        'contentDiversity': 60,
        'sourceVerifiability': 70,
        'starRating': 3,
        'version': '1.0',
        'priority': 'medium',
        'dataSources': [
            {'type': '著作', 'source': '公开出版物', 'quantity': '主要作品', 'quality': '5'},
            {'type': '经济学人文章', 'source': '网络档案', 'quantity': '部分', 'quality': '3'},
        ],
        'mainGaps': ['私人书信未全量覆盖'],
    },
    'osamu-dazai': {
        'overall': 58,
        'dataCoverage': 55,
        'rawMaterial': 55,
        'timeSpan': 80,
        'contentDiversity': 50,
        'sourceVerifiability': 60,
        'starRating': 2,
        'version': '1.0',
        'priority': 'low',
        'dataSources': [
            {'type': '文学作品', 'source': '公开出版物/古登堡', 'quantity': '主要作品', 'quality': '4'},
        ],
        'mainGaps': ['私人日记未获取'],
    },
}

def generate_confidence_entry(persona_id: str, data: dict) -> str:
    """生成置信度条目代码"""
    sources_str = '\n    '.join([
        f"{{ type: '{s['type']}', source: '{s['source']}', quantity: '{s['quantity']}', quality: '{s['quality']}' }}"
        for s in data['dataSources']
    ])
    
    gaps_str = '\n    '.join([f"'{g}'," for g in data['mainGaps']])
    
    return f"""  '{persona_id}': {{
    overall: {data['overall']},
    dataCoverage: {data['dataCoverage']},
    rawMaterial: {data['rawMaterial']},
    timeSpan: {data['timeSpan']},
    contentDiversity: {data['contentDiversity']},
    sourceVerifiability: {data['sourceVerifiability']},
    starRating: {data['starRating']} as const,
    version: '{data['version']}',
    priority: '{data['priority']}' as const,
    dataSources: [
    {sources_str}
    ],
    mainGaps: [
    {gaps_str}
    ],
  }},"""

def main():
    print("=" * 60)
    print("缺失置信度的人物分析")
    print("=" * 60)
    
    for pid, data in MISSING_PERSONAS.items():
        print(f"\n{pid}:")
        print(f"  置信度: {data['overall']}%")
        print(f"  优先级: {data['priority']}")
        print(f"  来源数量: {len(data['dataSources'])}")
        print(f"  主要缺口: {data['mainGaps'][0]}")
    
    print("\n" + "=" * 60)
    print("生成代码片段:")
    print("=" * 60)
    
    for pid, data in MISSING_PERSONAS.items():
        print()
        print(generate_confidence_entry(pid, data))

if __name__ == '__main__':
    main()
