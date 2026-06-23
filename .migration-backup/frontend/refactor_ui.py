import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    
    # Needs Select / Textarea imports
    needs_select = False
    needs_textarea = False
    
    # 1. Replace Textarea block
    # Pattern to match:
    # <div ...>
    #   <label ...> ... </label>
    #   <textarea ...> ... </textarea>
    #   {errors.X && ... }
    # </div>
    
    # Because nested divs might exist, a simple regex might fail. 
    # Let's try to find <label ...>(.*?)</label>\s*<textarea(.*?)>(.*?)</textarea>\s*(\{errors\.([a-zA-Z0-9_]+) &&.*?\})?
    
    textarea_pattern = re.compile(r'<label[^>]*>(.*?)</label>\s*<textarea([^>]*)>(.*?)</textarea>(\s*\{errors\.([a-zA-Z0-9_]+).*?</p>\s*\}|\s*\{errors\.([a-zA-Z0-9_]+) &&\s*\(\s*<p[^>]*>.*?</p>\s*\)\s*\})?', re.DOTALL)
    
    def repl_textarea(m):
        nonlocal needs_textarea
        needs_textarea = True
        label_content = m.group(1).strip()
        attrs = m.group(2)
        inner = m.group(3)
        err_block1 = m.group(5)
        err_block2 = m.group(6)
        err_var = err_block1 or err_block2
        
        err_prop = f' error={{errors.{err_var}?.message}}' if err_var else ''
        
        # Remove classNames from Textarea if we want, or keep them. The user wants to replace them with the new component.
        # We should keep {...register(...)} and other props like rows.
        # Let's strip className completely to use the component's default styles? 
        # Actually it's safer to keep it, but the UI component already applies styles.
        # Let's remove className="..."
        attrs = re.sub(r'className=(["\']).*?\1', '', attrs)
        attrs = re.sub(r'className=\{.*?\}', '', attrs)
        
        return f'<Textarea{attrs} label={{<>{label_content}</>}}{err_prop}>{inner}</Textarea>'

    content = textarea_pattern.sub(repl_textarea, content)
    
    # Pattern for select
    select_pattern = re.compile(r'<label[^>]*>(.*?)</label>\s*<select([^>]*)>(.*?)</select>(\s*\{errors\.([a-zA-Z0-9_]+).*?</p>\s*\}|\s*\{errors\.([a-zA-Z0-9_]+) &&\s*\(\s*<p[^>]*>.*?</p>\s*\)\s*\})?', re.DOTALL)
    
    def repl_select(m):
        nonlocal needs_select
        needs_select = True
        label_content = m.group(1).strip()
        attrs = m.group(2)
        inner = m.group(3)
        err_block1 = m.group(5)
        err_block2 = m.group(6)
        err_var = err_block1 or err_block2
        
        err_prop = f' error={{errors.{err_var}?.message}}' if err_var else ''
        
        # Remove inline style for select
        attrs = re.sub(r'style=\{\{.*?\}\}', '', attrs, flags=re.DOTALL)
        attrs = re.sub(r'className=(["\']).*?\1', '', attrs)
        attrs = re.sub(r'className=\{.*?\}', '', attrs)
        
        return f'<Select{attrs} label={{<>{label_content}</>}}{err_prop}>{inner}</Select>'

    content = select_pattern.sub(repl_select, content)
    
    # Also catch standalone <select> and <textarea> without labels
    standalone_textarea = re.compile(r'<textarea([^>]*)>(.*?)</textarea>', re.DOTALL)
    def repl_standalone_textarea(m):
        nonlocal needs_textarea
        needs_textarea = True
        attrs = m.group(1)
        inner = m.group(2)
        attrs = re.sub(r'className=(["\']).*?\1', '', attrs)
        return f'<Textarea{attrs}>{inner}</Textarea>'
        
    standalone_select = re.compile(r'<select([^>]*)>(.*?)</select>', re.DOTALL)
    def repl_standalone_select(m):
        nonlocal needs_select
        needs_select = True
        attrs = m.group(1)
        inner = m.group(2)
        attrs = re.sub(r'style=\{\{.*?\}\}', '', attrs, flags=re.DOTALL)
        attrs = re.sub(r'className=(["\']).*?\1', '', attrs)
        return f'<Select{attrs}>{inner}</Select>'
        
    # Only replace if they are lower case <textarea and <select
    if '<textarea' in content:
        content = standalone_textarea.sub(repl_standalone_textarea, content)
    if '<select' in content:
        content = standalone_select.sub(repl_standalone_select, content)
        
    if content != original_content:
        # Determine import path depth
        depth = filepath.count('/') - 1 # Assuming src is top level
        # Actually filepath is full path or relative to frontend.
        # We can calculate relative path to src/components/ui
        parts = filepath.split('src')[1].strip('\\/').replace('\\', '/').split('/')
        up_levels = len(parts) - 1
        prefix = '../' * up_levels if up_levels > 0 else './'
        
        imports_to_add = []
        if needs_select and 'import { Select }' not in content:
            imports_to_add.append(f"import {{ Select }} from '{prefix}components/ui/Select';")
        if needs_textarea and 'import { Textarea }' not in content:
            imports_to_add.append(f"import {{ Textarea }} from '{prefix}components/ui/Textarea';")
            
        if imports_to_add:
            # insert after last import
            imports_str = '\n'.join(imports_to_add) + '\n'
            last_import_idx = content.rfind('import ')
            if last_import_idx != -1:
                end_of_last_import = content.find('\n', last_import_idx)
                if end_of_last_import != -1:
                    content = content[:end_of_last_import+1] + imports_str + content[end_of_last_import+1:]
                else:
                    content = imports_str + content
            else:
                content = imports_str + content
                
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

import glob

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.jsx'):
            process_file(os.path.join(root, file))

print("Done")
