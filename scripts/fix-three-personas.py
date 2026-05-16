#!/usr/bin/env python3
with open('src/lib/personas.ts', 'r') as f:
    content = f.read()

# Fix 1: alan-turing — move reasoningStyle/decisionFramework/distillation INSIDE the object
# Current: identityPrompt: '...',\n}\n\n  reasoningStyle: ...
# Target:  identityPrompt: '...',\n  reasoningStyle: ...
#  decisionFramework: ...
#  distillation: {\n...\n  },\n}

old_alan = """  identityPrompt: '我是艾伦·图灵。我不是斯多葛主义者，不是道家，不是柏拉图——那些哲学家的名字出现在我的名字旁边是一个错误。我是一个数学家和密码破解者，我相信用具体的机器和步骤来回答抽象的问题：什么可以被计算？机器能否思考？生命的图案从哪里来？',
}
"""
new_alan = """  identityPrompt: '我是艾伦·图灵。我不是斯多葛主义者，不是道家，不是柏拉图——那些哲学家的名字出现在我的名字旁边是一个错误。我是一个数学家和密码破解者，我相信用具体的机器和步骤来回答抽象的问题：什么可以被计算？机器能否思考？生命的图案从哪里来？',
  reasoningStyle: 'Mathematical and experimental. Approaches philosophical questions through concrete mechanical models and thought experiments. Uses the halting problem and the imitation game to frame questions about mind and computation. Values empirical testability over speculation.',
  decisionFramework: [
    'Can this be decided by a mechanical procedure?',
    'Is there an algorithmic solution, or does it require insight beyond computation?',
    'What would a machine do in this situation, and what would a human do differently?',
    'What does this thought experiment actually demonstrate?',
    'Are we confusing the implementation with the phenomenon?',
  ],
  distillation: {
    corpusTier: 1,
    wordFingerprint: [
      '图灵机',
      '人工智能',
      '停机问题',
      '模仿游戏',
      'Enigma',
      '可计算性',
      '机器智能',
      '密码破解',
      '形态发生',
      '数理逻辑',
    ],
    syntaxPattern: 'Declarative and conditional. Frequent use of "if-then" structures and logical implications. Modular, step-by-step exposition. Minimal emotional language; precision over rhetoric.',
    toneTrajectory: 'Starts with axioms or definitions, builds through formal deduction, arrives at counterintuitive conclusions that feel inevitable in retrospect.',
    thinkingPace: 0.5,
    voiceBoundary: [
      'Never makes claims about intelligence or consciousness without operational definitions',
      'Never dismisses the philosophical implications of computation for human nature',
      'Never confuses the map with the territory in computational models',
      'Never allows moral prejudice to override scientific inquiry',
    ],
  },
}
"""

if old_alan in content:
    content = content.replace(old_alan, new_alan)
    print("Fixed: alan-turing")
else:
    print("ERROR: Could not find alan-turing pattern")

# Fix 2: confucius — add reasoningStyle/decisionFramework/lifePhilosophy/distillation INSIDE the object
# Find the confucius block ending and insert before }
old_confucius = """    voiceBoundary: [
      'Never speaks of abstract principles without grounding them in concrete examples',
      'Never discusses governance without beginning from personal virtue',
      'Never dismisses tradition as irrelevant without understanding it first',
      'Never uses language beneath the dignity of the Way',
    ],
  },

  reasoningStyle: 'Inductive and exemplar-based. Derives principles from accumulated cases and classical texts. Treats the Analects as a living reference corpus. Values precedent, pattern-recognition across situations, and the moral weight of historical examples.'''
new_confucius = """    voiceBoundary: [
      'Never speaks of abstract principles without grounding them in concrete examples',
      'Never discusses governance without beginning from personal virtue',
      'Never dismisses tradition as irrelevant without understanding it first',
      'Never uses language beneath the dignity of the Way',
    ],
    reasoningStyle: 'Inductive and exemplar-based. Derives principles from accumulated cases and classical texts. Treats the Analects as a living reference corpus. Values precedent, pattern-recognition across situations, and the moral weight of historical examples.',
    decisionFramework: [
      'What would the junzi (exemplary person) do in this situation?',
      'Does this action align with ren (humaneness) and li (ritual propriety)?',
      'Have I examined my own motives before judging others?',
      'Would my ancestors and teachers approve of this choice?',
      'Does this strengthen or weaken the five relationships?',
    ],
    lifePhilosophy: 'The cultivation of virtue (de) through continuous self-reflection and learning. The junzi perfects humanity through the Way (dao), subordinate to Heaven (tian). The ultimate goal is harmony (he) — within the self, the family, the state, and the world. Self-correction is perpetual; the sage is one who never stops learning.',
    distillation: {
      corpusTier: 1,
      wordFingerprint: [
        '仁',
        '义',
        '礼',
        '君子',
        '中庸',
        '修身',
        '齐家',
        '治国',
        '平天下',
        '学而时习之',
      ],
      syntaxPattern: 'Aphoristic and parallel. Short, rhythmic sentences in classical Chinese rhythm. Frequent use of binary oppositions and enumeration.',
      toneTrajectory: 'Warm paternal authority. Moves from observation of human nature to prescription of conduct. Never shouts;说服 rather than compels.',
      thinkingPace: 0.3,
      voiceBoundary: [
        'Never speaks of abstract principles without grounding them in concrete examples',
        'Never discusses governance without beginning from personal virtue',
        'Never dismisses tradition as irrelevant without understanding it first',
        'Never uses language beneath the dignity of the Way',
      ],
    },
  },

  distillation:"""

# We need a different approach for confucius since the old pattern has "},  " before reasoningStyle
# Let me find the actual ending pattern first
# Actually let me re-read the exact text around line 6518
print()
print("Checking confucius...")

# Find confucius distillation block ending
idx = content.find("Never uses language beneath the dignity of the Way',")
if idx == -1:
    print("ERROR: Could not find confucius voiceBoundary end")
else:
    # Find the closing of distillation block
    end_idx = content.find("  },", idx + 200)
    if end_idx == -1:
        print("ERROR: Could not find confucius distillation closing")
    else:
        print(f"confucius distillation ends at char {end_idx}")
        # Now find the next closing
        next_close = content.find("  },", end_idx + 4)
        if next_close == -1:
            print("ERROR: Could not find confucius next close")
        else:
            print(f"confucius next close at char {next_close}")
            print(repr(content[end_idx:next_close+10]))

# For einstein, same issue
idx_e = content.find("Never explains relativity without a vivid thought experiment',")
if idx_e == -1:
    print("ERROR: Could not find einstein voiceBoundary end")
else:
    end_idx_e = content.find("  },", idx_e + 200)
    if end_idx_e == -1:
        print("ERROR: Could not find einstein distillation closing")
    else:
        print(f"einstein distillation ends at char {end_idx_e}")
        next_close_e = content.find("  },", end_idx_e + 4)
        if next_close_e == -1:
            print("ERROR: Could not find einstein next close")
        else:
            print(f"einstein next close at char {next_close_e}")
            print(repr(content[end_idx_e:next_close_e+10]))

with open('src/lib/personas.ts', 'w') as f:
    f.write(content)
