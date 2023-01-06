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
