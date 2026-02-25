import pandas as pd
import zipfile
import io
import os

# Stand in Data folder; look for the zip you made
zip_path = 'project_data.zip' 
target_file = 'all_c_cpp_release2.0.csv'

print("--- 🚀 CISC 4900: Final Risk Characterization ---")

try:
    with zipfile.ZipFile(zip_path, 'r') as z:
        with z.open(target_file) as f:
            # FIX: Using 'latin1' to handle those C++ characters that crash charmap
            wrapper = io.TextIOWrapper(f, encoding='latin1')
            
            # Use the EXACT column name seen in your terminal screenshot
            df = pd.read_csv(wrapper, usecols=['vulnerability_classification'])
            
            # Since this is a vulnerability dataset, we characterize all entries
            results = df['vulnerability_classification'].value_counts().head(10)
            
            print("\n✅ SUCCESS: Top 10 Security Risks Identified!")
            print(results)

except Exception as e:
    print(f"❌ ERROR: {e}")