import sys

with open('components/load-shifting-card.tsx', 'r') as f:
    lines = f.readlines()

new_lines = []
skip_next_matched_group = False

for line in lines:
    if 'getRateForHour,' in line:
        continue # Remove import

    if 'const rate = getRateForHour(hour, tariffGroups)' in line:
        indent = line[:line.find('const')]
        new_lines.append(f'{indent}const matchedGroup = getTariffForHour(hour, tariffGroups)\n')
        new_lines.append(f'{indent}const rate = matchedGroup?.rate || 0\n')
        skip_next_matched_group = True
        continue

    if skip_next_matched_group and 'const matchedGroup = getTariffForHour(hour, tariffGroups)' in line:
        # This is the second occurrence which is now redundant
        skip_next_matched_group = False # Reset flag just in case
        continue

    new_lines.append(line)

with open('components/load-shifting-card.tsx', 'w') as f:
    f.writelines(new_lines)
