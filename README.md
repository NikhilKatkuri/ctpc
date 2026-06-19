# CTPC (Client-to-Provider Cipher)

**A [Stratify Minds](https://github.com/NikhilKatkuri) Project**
> A high-performance, zero-knowledge CLI utility for securing local files before cloud synchronization.

<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; font-family: sans-serif;">
  <img src="assets/Icon.svg" alt="CTPC Logo" width="256">
  <p><strong>ctcp</strong></p>
</div>


## Why this tool exists

Most cloud storage providers are not encrypted with your own keys. CTPC solves this by providing a local-first encryption layer, ensuring your data is unreadable to the provider while maintaining seamless sync compatibility.

## Installation

```bash
npm install -g ctpc
```

## Verify

```bash
ctpc -v
```

## Quick start

```bash
ctpc --help
ctpc encrypt --type .png,.jpg,.jpeg --nested -o ./outputs

```

## Commands

### encrypt

Encrypts files or entire directories using AES-256-CBC.

**Options**

| Option     | Alternative | Description                                                                                                         | Example                                                                                      |
| ---------- | ----------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `--type`   | `-t`        | Encrypt files matching one or more file extensions or glob-style patterns. Multiple values can be comma-separated.  | `ctpc encrypt --type .txt`<br>`ctpc encrypt --type .jpg,.png`<br>`ctpc encrypt --type *.log` |
| `--file`   | `-f`        | Encrypt one or more specific files by name. Multiple values can be comma-separated.                                 | `ctpc encrypt --file report.pdf`<br>`ctpc encrypt --file image.jpg,video.mp4`                |
| `--nested` | `-n`        | Recursively search subdirectories for matching files. Disabled by default.                                          | `ctpc encrypt --type .txt --nested`                                                          |
| `--input`  | `-i`        | Specify the root directory to search for files. Defaults to the current working directory (`.`).                    | `ctpc encrypt --type .pdf --input ./documents`                                               |
| `--output` | `-o`        | Specify the destination directory for encrypted files. Directory structure is preserved. Defaults to `./encrypted`. | `ctpc encrypt --type .jpg --output ./vault`                                                  |

**Example**

```bash
# Encrypt specific images in a project folder
ctpc encrypt --input ./projects/photos --type .jpg --nested true

```

### decrypt

Decrypts previously encrypted `.enc` files or directories.

**Options**

| Option     | Alias | Description                                                                                              | Sample                                                                                     |
| ---------- | ----- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `--path`   | `-p`  | Root directory containing encrypted files to search. **Default:** `.` (current directory).               | `ctpc decrypt --path ./encrypted`                                                          |
| `--file`   | `-f`  | Decrypt one or more specific encrypted files. Supports multiple comma-separated values.                  | `ctpc decrypt --file photo.jpg.enc`<br>`ctpc decrypt --file photo.jpg.enc,archive.zip.enc` |
| `--output` | `-o`  | Destination directory for decrypted files. Directory structure is preserved. **Default:** `./decrypted`. | `ctpc decrypt --output ./restored`                                                         |

**Example**

```bash
# Decrypt a specific list of files
ctpc decrypt --file ./data/img1.enc,./data/img2.enc

# Decrypt an entire directory
ctpc decrypt --path ./encrypted/backup

```

## Notes

- **Password Security:** Your password is the only secret required to decrypt your data. If it is lost or forgotten, recovery is not possible.

- **Data Integrity:** Encrypted files contain cryptographic metadata required for successful decryption. Modifying, truncating, or corrupting the file contents may permanently prevent recovery.

- **File Extensions:** By default, CTPC discovers encrypted files using the `.enc` extension. If you rename or remove this extension, automatic directory scanning will not detect the file. You can still decrypt it by providing its path explicitly with `--file`.

- **Output Directories:** CTPC automatically creates missing output directories when possible. Ensure you have sufficient write permissions for the selected destination.

- **Cloud Storage:** Encrypted files can be safely stored on cloud providers, external drives, or shared storage. Only someone with the correct password can decrypt them.

## Performance Report

CTPC displays a performance summary at the end of every successful encryption and decryption operation.

### Encryption

```text
┌── Performance Summary
│
│  Files Processed    : 1,470
│  Total Data         : 3.70 GB (3,790.16 MB)
│  Duration           : 36.66 s
│  Average Throughput : 103.39 MB/s
│  Average File Size  : 2.58 MB
│  Files / Second     : 40.10
│
└── Completed Successfully
```

### Decryption

```text
┌── Performance Summary
│
│  Files Processed    : 1,470
│  Total Data         : 3.70 GB (3,790.82 MB)
│  Duration           : 58.38 s
│  Average Throughput : 64.93 MB/s
│  Average File Size  : 2.58 MB
│  Files / Second     : 25.18
│
└── Completed Successfully
```

| Metric                 | Description                                   |
| ---------------------- | --------------------------------------------- |
| **Files Processed**    | Total number of files successfully processed. |
| **Total Data**         | Combined size of all processed files.         |
| **Duration**           | Total execution time for the operation.       |
| **Average Throughput** | Average processing speed measured in MB/s.    |
| **Average File Size**  | Mean size of the processed files.             |
| **Files / Second**     | Average number of files processed per second. |

### Report
| Metric     |     Encryption |     Decryption |
| ---------- | -------------: | -------------: |
| Files      |        **609** |        **609** |
| Total Data |  **634.49 MB** |  **634.76 MB** |
| Duration   |    **11.34 s** |    **11.70 s** |
| Throughput | **55.95 MB/s** | **54.25 MB/s** |

### Derived metrics

| Metric            |              Value |
| ----------------- | -----------------: |
| Average file size |  **≈1.04 MB/file** |
| Encryption rate   | **≈53.70 files/s** |
| Decryption rate   | **≈52.05 files/s** |



**Note:** Every successful encryption or decryption operation concludes with a performance summary, including the number of processed files, total data size, execution time, and average throughput.

## License

This project is licensed under the terms of the MIT License. See [LICENSE.md](./LICENSE.md) for details.
