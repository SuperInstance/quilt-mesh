#!/usr/bin/env python3
# quilt-mesh/drift_charts.py — the doctrine-drift receipts, drawn.
import json, os
import matplotlib
matplotlib.use('Agg')
import matplotlib.font_manager as fm
for f in ['/usr/share/fonts/truetype/chinese/NotoSansSC-Regular.ttf',
          '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
    if os.path.exists(f):
        fm.fontManager.addfont(f)
import matplotlib.pyplot as plt
plt.rcParams['font.sans-serif'] = ['Noto Sans SC', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

HERE = os.path.dirname(os.path.abspath(__file__))
INK, PAPER = '#1a2332', '#fbfaf7'
BLUE, ORANGE, TEAL, GRAY, RED = '#2f6f8f', '#c96f2e', '#3d8a7d', '#9aa1ab', '#a94438'

with open(os.path.join(HERE, 'outputs', 'drift_receipts.json')) as f:
    D = json.load(f)

foundry = D['foundry']
targets = [f['target'] for f in foundry]

# ── chart 1: bloodline entropy, first half vs second half ───────────────────
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12.6, 4.6), constrained_layout=True)
fig.patch.set_facecolor(PAPER)
for ax in (ax1, ax2):
    ax.set_facecolor(PAPER)
    ax.spines[['top', 'right']].set_visible(False)
    ax.spines[['left', 'bottom']].set_color(GRAY)
    ax.tick_params(colors=INK, labelsize=8.6)
    ax.grid(color=GRAY, alpha=0.18, lw=0.6, axis='y')

x = range(len(targets))
W = 0.36
early = [f['entropyEarly'] for f in foundry]
late = [f['entropyLate'] for f in foundry]
ax1.bar([xx - W / 2 for xx in x], early, width=W, color=TEAL, label='crown-family entropy, first half of gens', alpha=0.9)
ax1.bar([xx + W / 2 for xx in x], late, width=W, color=GRAY, label='second half', alpha=0.9)
ax1.set_xticks(list(x))
ax1.set_xticklabels(targets, rotation=40, ha='right')
ax1.set_ylabel('Shannon entropy of crowned families')
ax1.set_title('the archive saturates early: every bloodline crowns in the first half', color=INK, fontsize=10.5)
ax1.legend(frameon=False, fontsize=8.2)

# ── chart 2: bazaar trade edges — woven vs bounced, re-trades highlighted ───
edges = D['edges']
labels = [f"{e['from']}→{e['to']}\n{e['family']}" for e in edges]
woven = [e['woven'] for e in edges]
bounced = [e['attempts'] - e['woven'] for e in edges]
colors = []
for e in edges:
    colors.append(TEAL if e['woven'] == e['attempts'] else (RED if e['woven'] == 0 else ORANGE))
ax2.bar(range(len(edges)), woven, color=TEAL, alpha=0.9, label='woven (accepted at the border)')
ax2.bar(range(len(edges)), bounced, bottom=woven, color=RED, alpha=0.75, label='caught in transit (bounced)')
ax2.set_xticks(range(len(edges)))
ax2.set_xticklabels(labels, fontsize=7.4)
ax2.set_ylabel('trade attempts')
ax2.set_title('the bazaar border: re-traded families bounce (0/2) —\nimported logic is barred from re-export as new blood', color=INK, fontsize=10.5)
ax2.legend(frameon=False, fontsize=8.2)
for i, e in enumerate(edges):
    if e['woven']:
        ax2.text(i, e['woven'] / 2, str(e['woven']), ha='center', color='white', fontsize=9)
    if bounced[i]:
        ax2.text(i, e['woven'] + bounced[i] / 2, str(bounced[i]), ha='center', color='white', fontsize=9)
fig.savefig(os.path.join(HERE, 'outputs', 'doctrine_drift.png'), dpi=160, facecolor=PAPER)
plt.close(fig)
print('chart written: outputs/doctrine_drift.png')
