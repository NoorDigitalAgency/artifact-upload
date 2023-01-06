# Artifact Upload with Backblaze as the backend

Replacement for the `actions/upload-artifact` that is extrimly slow. This alternative uses Backblaze as the backup storage and creates a TAR bundle for the uploading and can be between 2 to 100 times faster than the `actions/upload-artifact` depending on the number and size of the artifact files.

```yaml
      - uses: noordigitalagency/artifact-upload@main
        with:
          name: artifact
          path: ./
          if-no-files-found: warn
          key: ${{ secrets.BACKBLAZE_KEY }}
          id: ${{ secrets.BACKBLAZE_ID }}
          bucket: ${{ secrets.BACKBLAZE_BUCKET }}
```
