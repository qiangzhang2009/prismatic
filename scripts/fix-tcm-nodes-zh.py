#!/usr/bin/env python3
"""Fix English text in tcm-nodes.json - add Chinese translations for values, tensions, mentalModels, and fix contributions."""

import json
from pathlib import Path

# All translation mappings merged into one place
ALL_VALUE_TRANSLATIONS = {
    "Empirical Rigor": "实证求真",
    "Systematic Classification": "系统分类",
    "Holistic Diagnosis": "整体诊断",
    "Safety and Caution": "安全审慎",
    "Intellectual Humility": "求知若虚",
    "Life Preservation": "珍视生命",
    "Root Cause Analysis": "溯源分析",
    "Empirical Evidence": "实证为据",
    "Gentle Intervention": "温和施治",
    "Holistic Balance": "整体平衡",
    "Holistic Health": "整体健康",
    "Physician Integrity": "医者正道",
    "Eternal Knowledge": "永恒真理",
    "Prevention over Cure": "预防为先",
    "Balance and Harmony": "平衡和谐",
    "Classical Orthodoxy": "尊经守正",
    "Clinical Pragmatism": "临床务实",
    "Spleen-Stomach Centrism": "脾胃为本",
    "Formula-Syndrome Precision": "方证精准",
    "Humility Before Classics": "敬仰经典",
    "Classical Authority": "经典权威",
    "Pragmatic Eclecticism": "临床务实",
    "Clinical Efficacy": "临床疗效",
    "Innovation within Tradition": "守正创新",
    "Holistic Qi Transformation": "气化整体",
    "Empirical Truth": "实证求真",
    "Intellectual Honesty": "求真务实",
    "Benevolence (Yi De)": "仁心仁术",
    "Courage to Innovate": "创新勇气",
    "Precision in Diagnosis": "诊断精准",
    "Empirical Verification": "实证验证",
    "Preservation of Classical Knowledge": "传承经典",
    "Holistic Consideration": "整体考量",
    "Respect for Tradition with Innovation": "守正创新",
    "Patient-Centered Care": "以患者为本",
    "Harmony with Nature": "顺应自然",
    "Individualized Treatment": "因人制宜",
    "Inner Cultivation": "内修身心",
    "Rationality": "理性审慎",
    "Observation": "观察入微",
    "Beneficence": "普救含灵",
    "Humility": "谦逊求教",
    "Holism": "整体观念",
    "Preserve Yin Fluids": "存阴护津",
    "Adapt Classical Wisdom": "因时制宜",
    "Precision in Differentiation": "辨证精准",
    "Preventive Intervention": "治未先防",
    "Systematic Synthesis": "系统综合",
    "Yin Protection": "保护阴液",
    "Preventive Medicine": "预防医学",
    "Balanced Approach": "中道平衡",
    "Practical Efficacy": "实效为重",
    "Humility in Learning": "虚心求知",
    "Ahimsa (Non-Harm)": "不害",
    "Practical Skill": "技术精熟",
    "Empirical Observation": "经验观察",
    "Compassion": "慈悲为怀",
    "Life First": "生命至上",
    "Holistic Harmony": "整体和谐",
    "Empirical Precision": "实证精确",
    "Innovation and Courage": "创新敢为",
    "Compassion and Non-Greed": "慈悲不贪",
    "Precision in Pattern Differentiation": "辨证精准",
    "Protect Fluids": "护津存阴",
    "Flexibility over Dogma": "灵活变通",
    "Evidence-Based Observation": "以据为证",
    "Evidence-Based Practice": "循证实践",
    "Spleen-Stomach as Foundation": "脾胃为基",
    "Pulse as Foundation": "脉诊为本",
    "Preventive Care": "预防为先",
    "Natural Harmony": "自然和谐",
    "Root Treatment": "治病求本",
    "Compassion (Ren)": "慈悲（仁）",
    "Sincerity (Cheng)": "至诚",
    "Equality (Pingdeng)": "待人平等",
    "Humility (Qianxu)": "谦逊",
    "Simplicity (Jianyue)": "简朴",
    "Defense-Qi-Nutrient-Blood Pattern Differentiation": "卫气营血辨证",
    "Pulse Classification System": "脉象分类体系",
    "Life Preservation": "养生延年",
}

ALL_TENSION_TRANSLATIONS = {
    "Tonify vs Drain": "补益与攻邪",
    "Internal vs External": "内伤与外伤",
    "Classical Authority vs Clinical Innovation": "尊经与变通",
    "Eternal Truth vs. Practical Adaptation": "永恒真理与因时变通",
    "Rational Medicine vs. Ritual/Incantation": "理性医学与宗教仪式",
    "Physician as Healer vs. Physician as Philosopher": "医者与哲人",
    "Surgery vs. Conservative Care": "手术与非手术",
    "Theory vs. Practice": "理论与实践",
    "Tradition vs. Innovation": "传承与创新",
    "Simplicity vs. Complexity": "简约与繁复",
    "Local vs. Universal": "地域与普适",
    "Anatomy vs. Function": "解剖与功能",
    "Empiricism vs. Mechanism": "经验与机制",
    "Standardization vs. Individualization": "标准化与个体化",
    "Intervention vs. Non-intervention": "干预与不干预",
    "Theory vs. Observation": "理论与观察",
    "Physician's Authority vs. Patient's Autonomy": "医者主导与患者自主",
    "Tradition vs Innovation": "传承与创新",
    "Purgation vs Nourishment": "攻邪与补益",
    "Warm Disease vs Cold Damage": "温病与伤寒",
    "Warm Disease vs. Cold Damage": "温病与伤寒",
    "Attack vs. Nourish": "攻与补",
    "Classical Formula vs. Individualized Treatment": "经方与化裁",
    "Classical Formulas vs. Empirical Innovation": "经方与经验",
    "Southern vs. Northern Medicine": "南北医学",
    "Warm Tonification vs. Cold Purgation": "温补与寒凉",
    "Medicine as Art vs. Science": "医术与科学",
    "Qi Transformation vs. Physical Structure": "气化与结构",
    "Blood vs. Qi Primacy": "血与气为本",
    "Heart vs. Brain as Seat of Mind": "心与脑主神志",
    "Nourishment vs. Purgation": "补益与攻邪",
    "Nourish Yin vs. Unblock Yang": "滋阴与通阳",
    "Anatomical Precision vs. Functional Holism": "解剖精确与功能整体",
    "Confidence vs. Humility": "自信与谦逊",
    "Specialization vs. Integration": "专精与整合",
    "Empiricism vs. Theory": "经验与理论",
    "Pulse vs. Other Diagnostics": "脉诊与其他诊断",
    "Classical vs. Modern": "经典与现代",
    "Tonification vs. Elimination": "补益与祛邪",
    "Internal Medicine vs. Surgery": "内科与外科",
    "Quantitative Precision vs. Qualitative Intuition": "量化精确与直觉判断",
    "Internal vs External": "内伤与外伤",
    "Life vs. Efficacy": "生命与疗效",
    "Breadth vs. Depth": "广博与专精",
    "Prevention vs. Intervention": "预防与治疗",
}

ALL_MM_TRANSLATIONS = {
    "Pulse Classification System": "脉象分类体系",
    "Three-Part Palpation (Cun-Guan-Chi)": "三部九候寸关尺诊法",
    "Yin-Yang Pulse Differentiation": "阴阳脉法",
    "Seasonal and Constitutional Pulse Variation": "时令与体质脉象变异",
    "Spleen-Stomach as Postnatal Foundation": "脾胃为后天之本",
    "Mind Originates from Heart and Brain": "心脑共主神明",
    "Iron Supplementation for Blood Heat": "以铁补铁退蒸热",
    "Gastric Acid and Emotional Regulation": "胃酸与情志相关",
    "Foot Meridians Over Hand Meridians": "足经统手经",
    "Tridosha Equilibrium": "三体液平衡模型",
    "Tridosha Equilibrium Model": "三体液平衡模型",
    "Surgical Anatomy Model": "外科解剖模型",
    "Dietetic Therapeutics Model": "饮食治疗模型",
    "Surgical Training Model": "外科训练模型",
    "Humoral Pathogenesis Model": "体液发病模型",
    "Defense-Qi-Nutrient-Blood Pattern Differentiation": "卫气营血辨证",
    "Sequential vs. Reverse Transmission": "顺传与逆传",
    "Unblocking Yang is the Hardest": "通阳最难",
    "Combat Sweat to Expel Pathogen": "战汗透邪",
    "Tongue and Teeth Diagnosis": "察舌验齿",
    "Mingmen (Life Gate) Theory": "命门学说",
    "Warm Tonification Method": "温补法",
    "Eight Battle Arrays of Formulae": "八阵方剂",
    "Seeking Yin within Yang, Seeking Yang within Yin": "阴中求阳，阳中求阴",
    "Treating Disease as Warfare": "治病如用兵",
    "Yang Excess Yin Deficiency": "阳常有余阴常不足",
    "Phlegm and Fire as Pathogenic Factors": "痰火致病论",
    "Six Depressions Theory": "六郁学说",
    "Spleen and Stomach as the Center": "脾胃为根本",
    "Pulse as the Key to Diagnosis": "脉诊为辨证关键",
    "Triple Burner Differentiation": "三焦辨证",
    "Nourish Yin to Preserve Fluids": "救阴存津",
    "Warm Disease Enters via Mouth and Nose": "温病口鼻而入",
    "Differentiate Warm from Cold Damage": "寒温之辨",
    "Use Ancient Methods, Not Ancient Formulas": "用古法不拘古方",
    "Prevent Convulsion Before Onset": "先安未受邪之地",
    "Four Humors Theory": "四体液学说",
    "Healing Power of Nature": "自然治愈力",
    "Systematic Clinical Observation": "系统临床观察",
    "Dietetics and Regimen": "饮食与养生法",
    "Environmental and Seasonal Influence": "环境与季节影响",
    "Yin-Yang Balance": "阴阳平衡",
    "Five Phases Correspondence": "五行相应",
    "Qi Mechanism": "气机升降",
    "Zang-Fu Organ System": "藏象脏腑系统",
    "Preventive Treatment": "治未病",
    "Empirical Anatomy": "实证解剖",
    "Qi Deficiency Leading to Blood Stasis": "气虚血瘀",
    "Blood Stasis Differentiation": "血瘀辨证",
    "Critical Examination of Classical Texts": "批判性审视经典",
    "Qi Mechanism and Vascular System": "气机与血管系统",
    "Spleen-Stomach as Center of Qi Transformation": "脾胃为气机升降枢纽",
    "Fire and Qi Incompatibility": "火与元气不两立",
    "Ascending Clear and Descending Turbid": "升清降浊",
    "Sweet-Warm Method to Remove Heat": "甘温除热",
    "Differentiation of Internal and External Injury": "内外伤辨",
    "Medication as Qi Guide": "用药如用兵，升降浮沉",
    "Law of Similars and Opposites": "相似与相反法则",
    "Five Elements and Six Tastes": "五大元素与六味",
    "Ayus as Conjunction of Body, Senses, Mind, and Self": "生命是身体、感官、心智与自我的结合",
    "Eternal Nature of Ayurveda": "阿育吠陀的永恒性",
    "Heaven-Human Correspondence": "天人相应",
    "Five Phases Mutual Generation": "五行相生",
    "Pulse Diagnosis for Prognosis": "脉诊决死生",
    "Surgical Intervention with Anesthesia": "麻醉下外科干预",
    "Formula Composition Principles": "方剂配伍原则",
    "Yin-Yang Dialectics": "阴阳辩证",
    "Four Seasons Nurturing": "四时调摄",
    "Damp-Heat Pathogenesis": "湿热致病",
    "Classical Text Criticism": "经典文本批判",
    "Holistic Diagnosis": "整体诊断",
    "Cunkou Pulse Model": "寸口脉模型",
    "Yin-Yang Pulse Model": "阴阳脉模型",
    "Five Element Pulse Model": "五行脉模型",
    "Five Pathogen Model": "五邪模型",
    "Qi Root Model": "生气之原模型",
    "Sun-Yi Pulse Model": "损至脉模型",
    "Pulse vs. Other Diagnostics": "脉诊与其他诊断",
    "Reverence for Zhang Zhongjing": "尊崇仲景",
    "Harmonizing Nutritive and Defensive Qi": "调和营卫",
    "Sweet Medicinals for Deficiency": "甘药补虚",
    "Qi and Blood Coordination": "气血同调",
    "Qi-Blood-Water-Fire Interdependence": "气血水火互根模型",
    "Spleen as Central Hub of Qi and Blood": "脾为气血中枢模型",
    "Yin-Yang Structural Qi Transformation": "阴阳形气转化模型",
    "Five Elements Qi Correspondence for Herbology": "五运六气本草对应模型",
    "Four Methods for Blood Disorders": "血证四步治法模型",
    "Holistic Prevention and Nourishment": "整体预防与摄养",
    "The Great Physician's Virtue (Da Yi Jing Cheng)": "大医精诚",
    "Syndrome Differentiation and Holistic Diagnosis": "辨证论治与整体诊断",
    "Reverence for Life and Minimal Harm": "敬畏生命与最小伤害",
    "Broad Learning and Interdisciplinary Knowledge": "博学与跨学科知识",
    "Yin-Yang Balance and Diagnosis": "阴阳平衡与诊断",
    "Spleen and Kidney as the Root of Life": "脾肾为生命之本",
    "Ge Wu Qiong Li (Investigation of Things to Exhaust Principle)": "格物穷理",
    "Zheng Ming Wei Gang (Correct Naming as the Outline)": "正名为纲",
    "Si Zhen He Can (Four Examinations Combined)": "四诊合参",
    "Qi Jing Ba Mai (Eight Extraordinary Meridians)": "奇经八脉",
    "Pao Zhi You Fa (Proper Processing Methods)": "炮炙有法",
}

CONTRIBUTION_FIXES = {
    "caraka": (
        "遮罗迦（Charaka），古代印度医学巨匠，《遮罗迦本集》（Charaka Samhita）的作者，与《妙闻本集》（Sushruta Samhita）并称阿育吠陀医学的两大基石。"
        "该书系统阐述了病因学、诊断学、治疗学，提出了三体液学说（Vata、Pitta、Kapha）、健康观、饮食指南、药物分类及医德规范。"
        "其三体液平衡模型与中医阴阳五行理论高度共鸣，为古代世界最重要的医学百科全书之一。"
    ),
    "hippocrates": (
        "希波克拉底（约公元前460年—前370年），古希腊医学之父，西方医学奠基人。他摒弃了疾病的神学解释，建立以四体液学说为核心的医学体系，"
        "强调观察、饮食疗法、自然治愈力及预防医学。其「首先不伤害」（Primum non nocere）原则至今仍是医学伦理的核心。"
        "希波克拉底的许多理念与中医理论惊人地平行，包括整体观念、环境影响、个体化治疗等。"
    ),
    "sushruta": (
        "妙闻（Sushruta），古代印度外科之父，《妙闻本集》（Sushruta Samhita）的作者。"
        "该书系统记载了超过300种外科手术、92种药方、700多种草药，以及精细的外科解剖学知识。"
        "妙闻发明了鼻整形术等众多手术技术，并强调医师培训要重视实践操作。"
        "他的外科体系与华佗的外科成就东西辉映，代表了古代医学实践的最高水平。"
    ),
    "wangshuhen": (
        "王叔和（公元3世纪），西晋著名医学家，曾任太医令。他最大的贡献是整理编次了张仲景的《伤寒杂病论》，使其得以流传后世。"
        "此外，他著《脉经》十卷，系统总结了24种脉象及其临床意义，建立了中医脉学的规范化体系，对后世脉学发展影响深远，被后世尊为脉学之祖。"
    ),
    "zhadanxin": (
        "张从正（约1156-1228），金代著名医学家，金元四大家之一，攻邪派（又称寒凉派）创始人。"
        "他继承了刘完素的火热病机思想，反对滥用温补，极力倡导「攻邪」疗法，认为疾病多由外邪入侵所致，治疗当以发汗、呕吐、泻下等法祛邪外出。"
        "其学术思想与李东垣的补土派形成鲜明对照，共同推动了金元时期医学理论的繁荣。"
    ),
    "liudunhou": (
        "刘完素（约1120-1200），金代著名医学家，金元四大家之首，寒凉派（又称火热论派）创始人。"
        "他精研《黄帝内经》，在病机理论上独树一帜，认为火热是多数疾病的共同病机，治疗当以寒凉药物清热泻火为主。"
        "他善于灵活运用寒凉方药，打破了宋代以来固守温燥的风气，开创了金元医学争鸣的新局面。"
    ),
}


def main():
    nodes_path = Path(__file__).parent.parent / "corpus" / "distilled" / "tcm" / "tcm-nodes.json"
    nodes = json.loads(nodes_path.read_text(encoding="utf-8"))

    fixed_count = 0

    for node in nodes:
        changed = False

        # Fix values: always set valuesZh to Chinese
        if node.get("values"):
            new_values_zh = [ALL_VALUE_TRANSLATIONS.get(v, v) for v in node["values"]]
            if new_values_zh != node.get("valuesZh"):
                node["valuesZh"] = new_values_zh
                changed = True

        # Fix tensions: always set tensionsZh to Chinese
        if node.get("tensions"):
            new_tensions_zh = [ALL_TENSION_TRANSLATIONS.get(t, t) for t in node["tensions"]]
            if new_tensions_zh != node.get("tensionsZh"):
                node["tensionsZh"] = new_tensions_zh
                changed = True

        # Fix mental models: add Chinese if missing or incomplete
        if node.get("mentalModels"):
            mm = node["mentalModels"]
            mm_zh = node.get("mentalModelsZh") or []
            if len(mm_zh) < len(mm):
                new_mm_zh = list(mm_zh)
                for m in mm[len(mm_zh):]:
                    new_mm_zh.append(ALL_MM_TRANSLATIONS.get(m, m))
                node["mentalModelsZh"] = new_mm_zh
                changed = True

        # Fix contribution for partial-English entries
        if node["id"] in CONTRIBUTION_FIXES:
            if node["contribution"] != CONTRIBUTION_FIXES[node["id"]]:
                node["contribution"] = CONTRIBUTION_FIXES[node["id"]]
                changed = True

        if changed:
            fixed_count += 1

    # Write back
    nodes_path.write_text(json.dumps(nodes, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Fixed {fixed_count} nodes. Done!")


if __name__ == "__main__":
    main()
