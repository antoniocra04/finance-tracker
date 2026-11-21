const paths = {
  refresh: 'M20 8a8 8 0 0 0-14-2L3 9m0-5v5h5m-4 7a8 8 0 0 0 14 2l3-3m0 5v-5h-5',
  eye: 'M2.5 12s3.4-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.4 5.5-9.5 5.5-9.5-5.5-9.5-5.5Zm11.5 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  eyeOff: 'm3 3 18 18M10.5 10.5a2 2 0 0 0 3 3M17.8 15.9A10.5 10.5 0 0 1 12 17.5C5.9 17.5 2.5 12 2.5 12a14 14 0 0 1 4.2-4.1m3.2-1.2c.7-.1 1.4-.2 2.1-.2 6.1 0 9.5 5.5 9.5 5.5s-.5.9-1.5 2',
  download: 'M12 15V3M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5 5 5 5-5',
  archive: 'M2 3h20v5H2zm2 5v13h16V8M10 12h4',
  search: 'm21 21-4.34-4.34M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  settings: 'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6',
  logout: 'm16 17 5-5-5-5M21 12H9m0 9H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4',
};
export function Glyph({ name }: { name: keyof typeof paths }) {
  return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>;
}
