import urllib.request
import zipfile
import os

url = 'https://learnopencv.s3.us-west-2.amazonaws.com/pothole_dataset.zip'
zip_path = 'pothole_dataset.zip'
extract_path = 'pothole_dataset'

if not os.path.exists(zip_path) or os.path.getsize(zip_path) < 46000000:
    print("Downloading dataset...")
    urllib.request.urlretrieve(url, zip_path)
    print("Download complete!")
else:
    print("Dataset already downloaded.")

print("Extracting...")
with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    zip_ref.extractall(extract_path)
print("Extraction complete!")
