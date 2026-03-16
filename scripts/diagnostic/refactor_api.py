import os
import re

def refactor_files(root_dir):
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith(('.jsx', '.js')):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        lines = f.readlines()

                    content = "".join(lines)
                    new_content = content

                    # 1. Refactor URLs
                    new_content = new_content.replace('http://localhost:5005/api', '/api')
                    
                    # 2. Add Truck import if used but missing
                    if '<Truck' in new_content or 'icon: Truck' in new_content or 'icon: <Truck' in new_content:
                        # Check if Truck is imported
                        has_import = re.search(r"import\s*\{[^}]*Truck[^}]*\}\s*from\s*['\"]lucide-react['\"]", new_content)
                        if not has_import:
                            # Try to add to existing lucide-react import
                            lucide_match = re.search(r"import\s*\{([^}]*)\}\s*from\s*['\"]lucide-react['\"]", new_content)
                            if lucide_match:
                                imports = lucide_match.group(1)
                                if 'Truck' not in imports:
                                    new_imports = imports.strip()
                                    if new_imports and not new_imports.endswith(','):
                                        new_imports += ','
                                    new_imports += ' Truck'
                                    new_content = new_content.replace(lucide_match.group(0), f"import {{ {new_imports} }} from 'lucide-react'")
                            else:
                                # Add new import at the top
                                new_content = "import { Truck } from 'lucide-react';\n" + new_content
                    
                    # 3. Final safety check for ProductDetails specific ReferenceError
                    if 'ProductDetails.jsx' in file_path:
                        # Force LucideTruck alias just in case of weird shadowing
                        new_content = re.sub(r"import\s*\{([^}]*)\}\s*from\s*['\"]lucide-react['\"]", 
                                             lambda m: m.group(0).replace('Truck', 'Truck as LucideTruck') if 'Truck' in m.group(1) and 'as LucideTruck' not in m.group(1) else m.group(0), 
                                             new_content)
                        new_content = new_content.replace('<Truck', '<LucideTruck')
                        new_content = new_content.replace('icon: Truck', 'icon: LucideTruck')

                    if new_content != content:
                        with open(file_path, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        print(f"Refactored: {file_path}")

                except Exception as e:
                    print(f"Error processing {file_path}: {e}")

if __name__ == "__main__":
    refactor_files('c:/Users/Admin/Desktop/HighPhaus/client/src')
