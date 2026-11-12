export type Appearance = 'system' | 'light' | 'dark';
export type AppearancePreview = {
  initial: Appearance;
  system: 'light' | 'dark';
  storageUnavailable?: boolean;
};

export function AppearanceSettings({
  value,
  onChange,
  resolved,
  storageUnavailable = false,
}: {
  value: Appearance;
  onChange: (value: Appearance) => void;
  resolved: 'light' | 'dark';
  storageUnavailable?: boolean;
}) {
  return (
    <fieldset className="appearance-settings">
      <legend>外観</legend>
      {(
        [
          ['system', 'システムに合わせる'],
          ['light', 'ライト'],
          ['dark', 'ダーク'],
        ] as const
      ).map(([option, label]) => (
        <label key={option}>
          <input
            type="radio"
            name="appearance"
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
          />
          {label}
        </label>
      ))}
      <p role="status">
        現在の表示：{resolved === 'light' ? 'ライト' : 'ダーク'}
      </p>
      {storageUnavailable && (
        <p role="alert">
          設定を保存できません。この画面を開いている間だけ適用します。
        </p>
      )}
    </fieldset>
  );
}
