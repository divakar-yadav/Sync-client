import sys
import pandas as pd
from sdv.single_table import CTGANSynthesizer
from sdv.metadata import SingleTableMetadata
import os


def main():
    # Read the file path from the arguments
    if len(sys.argv) < 2:
        print("Error: No file path provided.", file=sys.stderr)
        sys.exit(1)
    file_path = sys.argv[1]

    # Check if file exists
    if not os.path.exists(file_path):
        print(f"Error: File '{file_path}' not found.", file=sys.stderr)
        sys.exit(1)

    # Parse the optional row count argument
    row_count = None
    if len(sys.argv) > 2:
        try:
            row_count = int(sys.argv[2])
            if row_count <= 0:
                raise ValueError("Number of rows must be greater than 0.")
        except ValueError as e:
            print(f"Error: Invalid row count. {e}", file=sys.stderr)
            sys.exit(1)

    # Try to parse the file as JSON or CSV
    try:
        data = pd.read_json(file_path)
    except ValueError:
        try:
            data = pd.read_csv(file_path)
        except Exception as e:
            print(f"Error: Could not read file. {e}", file=sys.stderr)
            sys.exit(1)

    # Generate metadata
    metadata = SingleTableMetadata()
    metadata.detect_from_dataframe(data)

    # Create the synthesizer and fit the model
    synthesizer = CTGANSynthesizer(metadata)
    synthesizer.fit(data)

    # Determine the number of rows for synthetic data
    num_rows = row_count if row_count else len(data)

    # Generate synthetic data
    synthetic_data = synthesizer.sample(num_rows=num_rows)

    # Output the synthetic data as JSON
    print(synthetic_data.to_json(orient='records'))


if __name__ == "__main__":
    main()
