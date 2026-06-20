import os
import re

def refactor_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Skip if it doesn't use the local toast state
    if 'const [toast, setToast] = useState' not in content:
        return

    original_content = content

    # 1. Add import for useToast at the top (after other imports)
    if 'useToast' not in content:
        # Find last import
        import_match = list(re.finditer(r'^import .*;', content, flags=re.MULTILINE))
        if import_match:
            last_import = import_match[-1]
            insert_pos = last_import.end()
            content = content[:insert_pos] + "\nimport { useToast } from '../../context/ToastContext';" + content[insert_pos:]
        else:
            content = "import { useToast } from '../../context/ToastContext';\n" + content

    # 2. Replace local state definition with useToast hook
    content = re.sub(r'const \[toast, setToast\] = useState[^;]+;', 'const { showToast } = useToast();', content)

    # 3. Replace setToast calls
    # Pattern A: setToast({ message: '...', type: '...' })
    content = re.sub(
        r'setToast\(\s*\{\s*message:\s*(.+?),\s*type:\s*(.+?)\s*\}\s*\)',
        r'showToast(\1, \2)',
        content,
        flags=re.DOTALL
    )
    
    # Pattern B: setToast({ type: '...', message: '...' })
    content = re.sub(
        r'setToast\(\s*\{\s*type:\s*(.+?),\s*message:\s*(.+?)\s*\}\s*\)',
        r'showToast(\2, \1)',
        content,
        flags=re.DOTALL
    )

    # 4. Remove setTimeout(() => setToast(null), ...)
    content = re.sub(r'setTimeout\(\(\) => setToast\(null\),\s*\d+\);?', '', content)

    # 5. Remove the JSX toast rendering blocks
    def remove_toast_jsx(text):
        idx = text.find('{toast &&')
        if idx == -1:
            idx = text.find('{ toast &&')
        
        while idx != -1:
            open_braces = 0
            end_idx = -1
            for i in range(idx, len(text)):
                if text[i] == '{':
                    open_braces += 1
                elif text[i] == '}':
                    open_braces -= 1
                    if open_braces == 0:
                        end_idx = i
                        break
            if end_idx != -1:
                text = text[:idx] + text[end_idx+1:]
            else:
                break
            
            idx = text.find('{toast &&')
            if idx == -1:
                idx = text.find('{ toast &&')
        return text

    content = remove_toast_jsx(content)

    # If changes were made, write back
    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Refactored toasts in: {filepath}")

def main():
    root_dir = r"C:\Users\omar4\Desktop\University management system\frontend\src"
    for subdir, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.jsx'):
                filepath = os.path.join(subdir, file)
                refactor_file(filepath)

if __name__ == '__main__':
    main()
