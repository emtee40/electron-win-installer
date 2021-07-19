import { createTempDir } from '../src/temp-utils';
import { createWindowsInstaller } from '../src';
import debug from 'debug';
import * as fs from 'fs-extra';
import * as path from 'path';
import { spawnExe } from 'cross-spawn-windows-exe';
import test from 'ava';

const log = debug('electron-windows-installer:spec');

const fixtureAppDirectory = path.join(__dirname, 'fixtures/app');

async function spawn7z(args: string[]): Promise<string> {
  const sevenZipPath = path.join(__dirname, '..', 'vendor', '7z.exe');
  return spawnExe(sevenZipPath, args);
}

async function createTempAppDirectory(): Promise<string> {
  const appDirectory = await createTempDir('electron-winstaller-ad-');
  await fs.copy(fixtureAppDirectory, appDirectory);
  return appDirectory;
}

test('creates a nuget package and installer', async (t): Promise<void> => {
  const outputDirectory = await createTempDir('ei-');
  const appDirectory = await createTempAppDirectory();
  const options = { appDirectory, outputDirectory };

  await createWindowsInstaller(options);

  log(`Verifying assertions on ${outputDirectory}`);
  log(JSON.stringify(await fs.readdir(outputDirectory)));

  const nupkgPath = path.join(outputDirectory, 'myapp-1.0.0-full.nupkg');

  t.true(await fs.pathExists(nupkgPath));
  t.true(await fs.pathExists(path.join(outputDirectory, 'MyAppSetup.exe')));

  if (process.platform === 'win32') {
    t.true(await fs.pathExists(path.join(outputDirectory, 'MyAppSetup.msi')));
  }

  log('Verifying Update.exe');
  t.true(await fs.pathExists(path.join(appDirectory, 'Squirrel.exe')));

  log('Verifying contents of .nupkg');

  const packageContents = await spawn7z(['l', nupkgPath]);

  t.true(packageContents.includes('lib\\net45\\vk_swiftshader_icd.json'));
  t.true(packageContents.includes('lib\\net45\\swiftshader\\libEGL.dll'));
});

test('creates an installer when swiftshader files are missing', async (t): Promise<void> => {
  const appDirectory = await createTempAppDirectory();
  const outputDirectory = await createTempDir('electron-winstaller-test-');
  const options = { appDirectory, outputDirectory };

  // Remove swiftshader folder and swiftshader json file, simulating Electron < 10.0
  await fs.remove(path.join(appDirectory, 'swiftshader', 'libEGL.dll'));
  await fs.remove(path.join(appDirectory, 'swiftshader', 'libGLESv2.dll'));
  await fs.rmdir(path.join(appDirectory, 'swiftshader'));
  await fs.remove(path.join(appDirectory, 'vk_swiftshader_icd.json'));

  await createWindowsInstaller(options);

  const nupkgPath = path.join(outputDirectory, 'myapp-1.0.0-full.nupkg');

  log('Verifying contents of .nupkg');

  const packageContents = await spawn7z(['l', nupkgPath]);
  t.false(packageContents.includes('vk_swiftshader_icd.json'));
  t.false(packageContents.includes('swiftshader\\'));
});
