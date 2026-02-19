import os


def print_folder_structure(path, depth=0, max_depth=2):
    if depth > max_depth:
        return

    try:
        items = sorted(os.listdir(path))
        for item in items:
            item_path = os.path.join(path, item)
            if os.path.isdir(item_path):
                print('  ' * depth + '📁 ' + item)
                print_folder_structure(item_path, depth + 1, max_depth)
    except PermissionError:
        print('  ' * depth + '🚫 [Доступ запрещен]')


# Укажите путь к папке
target_path = 'scripts'  # текущая директория
print(f"Структура папок (глубина 2) для: {os.path.abspath(target_path)}\n")
print_folder_structure(target_path)