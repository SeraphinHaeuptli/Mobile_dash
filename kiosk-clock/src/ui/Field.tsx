import { StyleSheet, Text, TextInput, View } from 'react-native';

import { label } from '@/design/palette';
import { space, type } from '@/design/tokens';

/** A single-line text field laid out as a settings row. */
export function FieldRow({
  title,
  value,
  placeholder,
  onChangeText,
}: {
  title: string;
  value: string;
  placeholder?: string;
  onChangeText: (next: string) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={label.quaternary}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        inputMode="url"
        returnKeyType="done"
        selectionColor={label.secondary}
        accessibilityLabel={title}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.md,
  },
  title: { ...type.body, color: label.primary },
  input: {
    ...type.body,
    flex: 1,
    color: label.secondary,
    textAlign: 'right',
    padding: 0,
  },
});
