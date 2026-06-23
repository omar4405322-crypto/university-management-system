import json
from collections import Counter

with open('lint_results.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

counter = Counter()
total = 0

for file_result in data:
    for message in file_result.get('messages', []):
        rule = message.get('ruleId', 'unknown')
        counter[rule] += 1
        total += 1

print(f"Total Lint Issues: {total}")
for rule, count in counter.most_common():
    print(f"{rule}: {count}")
