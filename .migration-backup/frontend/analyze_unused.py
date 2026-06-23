import json

with open('lint_results.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

unused = []
for file_result in data:
    for message in file_result.get('messages', []):
        if message.get('ruleId') == '@typescript-eslint/no-unused-vars':
            unused.append({
                'file': file_result['filePath'],
                'line': message['line'],
                'message': message['message']
            })

for u in unused[:10]:
    print(f"{u['file']}:{u['line']} - {u['message']}")
print(f"Total: {len(unused)}")
