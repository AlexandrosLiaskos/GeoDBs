#!/usr/bin/env python3
"""
Process Greek Floods shapefile and create secure SQLite database
Converts coordinates from Greek Grid (EPSG:2100) to WGS84 (EPSG:4326)
"""

import sqlite3
from pathlib import Path
import struct
from typing import Dict, List, Any
import math


def read_shapefile_data(shp_path: str, dbf_path: str) -> List[Dict[str, Any]]:
    """Read shapefile geometry and attributes"""

    fields, num_records, record_length, header_length = _read_dbf_attributes(dbf_path)
    records = _read_dbf_records(dbf_path, fields, num_records, record_length, header_length)
    _read_shp_geometry(shp_path, records)

    return records



def _read_dbf_attributes(dbf_path: str) -> tuple[List[Dict[str, Any]], int, int, int]:
    """Read DBF header and field descriptors."""
    with open(dbf_path, 'rb') as f:
        header = f.read(32)
        num_records = struct.unpack('<I', header[4:8])[0]
        header_length = struct.unpack('<H', header[8:10])[0]
        record_length = struct.unpack('<H', header[10:12])[0]

        fields = []
        f.seek(32)
        while True:
            field_desc = f.read(32)
            if len(field_desc) < 32 or field_desc[0] == 0x0D:
                break

            field_name = (
                field_desc[:11].rstrip(b'\x00')
                .decode('ascii', errors='ignore')
            )
            field_type = chr(field_desc[11])
            field_length = field_desc[16]

            fields.append({
                'name': field_name,
                'type': field_type,
                'length': field_length
            })
    return fields, num_records, record_length, header_length


def _read_dbf_records(dbf_path: str, fields: List[Dict[str, Any]], num_records: int, record_length: int, header_length: int) -> List[Dict[str, Any]]:
    """Read DBF records."""
    records = []
    with open(dbf_path, 'rb') as f:
        f.seek(header_length)
        for i in range(num_records):
            record_data = f.read(record_length)
            if len(record_data) < record_length:
                break

            record_data = record_data[1:]  # Skip deletion flag

            record = {'id': i + 1}
            pos = 0

            for field in fields:
                field_data = record_data[pos:pos + field['length']]
                pos += field['length']

                if field['type'] == 'C':  # Character
                    value = field_data.rstrip(b'\x00 ').decode(
                        'utf-8', errors='ignore')
                elif field['type'] == 'F':  # Float
                    value_str = field_data.rstrip(
                        b'\x00 ').decode('ascii', errors='ignore')
                    try:
                        value = float(value_str) if value_str else None
                    except ValueError:
                        value = None
                else:
                    value = field_data.decode('utf-8', errors='ignore')

                record[field['name']] = value

            records.append(record)
    return records


def _read_shp_geometry(shp_path: str, records: List[Dict[str, Any]]) -> None:
    """Read SHP geometry and update records."""
    with open(shp_path, 'rb') as f:
        f.seek(100)  # Skip file header

        for record in records:
            try:
                record_header = f.read(8)
                if len(record_header) < 8:
                    break

                content_length = struct.unpack('>I', record_header[4:8])[0]
                shape_type = struct.unpack('<I', f.read(4))[0]

                if shape_type == 1:  # Point
                    x, y = struct.unpack('<dd', f.read(16))
                    record['x'] = x
                    record['y'] = y
                else:
                    f.seek(f.tell() + (content_length * 2) - 4)

            except (struct.error, IndexError, ValueError, TypeError):
                break


def _calculate_footprint_latitude(meridional_arc: float, semi_major_axis: float, e_squared: float) -> float:
    """Calculate footprint latitude (iterative)."""
    mu = meridional_arc / (semi_major_axis * (
        1 - e_squared/4 - 3*e_squared*e_squared/64 - 5*e_squared*e_squared*e_squared/256))

    e_one = (1 - math.sqrt(1 - e_squared)) / (1 + math.sqrt(1 - e_squared))
    j_one = 3 * e_one / 2 - 27 * e_one**3 / 32
    j_two = 21 * e_one**2 / 16 - 55 * e_one**4 / 32
    j_three = 151 * e_one**3 / 96
    j_four = 1097 * e_one**4 / 512

    footprint_latitude = (
        mu
        + j_one * math.sin(2 * mu)
        + j_two * math.sin(4 * mu)
        + j_three * math.sin(6 * mu)
        + j_four * math.sin(8 * mu)
    )
    return footprint_latitude


def _calculate_latitude_longitude(x: float, footprint_latitude: float, central_meridian: float, scale_factor: float, semi_major_axis: float, e_squared: float) -> tuple:
    """Calculate latitude and longitude."""
    c_one = e_squared * math.cos(footprint_latitude)**2 / (1 - e_squared)
    t_one = math.tan(footprint_latitude)**2
    r_one = semi_major_axis * (1 - e_squared) / (1 - e_squared * math.sin(footprint_latitude)**2)**(3/2)
    n_one = semi_major_axis / math.sqrt(1 - e_squared * math.sin(footprint_latitude)**2)
    d_val = x / (n_one * scale_factor)

    lat = _calculate_latitude_terms(d_val, footprint_latitude, n_one, r_one, t_one, c_one, e_squared)
    lon = _calculate_longitude_terms(d_val, footprint_latitude, central_meridian, t_one, c_one, e_squared)
    return lat, lon


def _calculate_latitude_terms(d_val: float, footprint_latitude: float, n_one: float, r_one: float, t_one: float, c_one: float, e_squared: float) -> float:
    """Calculate latitude terms."""
    q_one = n_one * math.tan(footprint_latitude) / r_one
    q_two = d_val**2 / 2
    q_three = (
        5 + 3*t_one + 10*c_one
        - 4*c_one**2 - 9*e_squared
    ) * d_val**4 / 24
    q_four = (
        61
        + 90 * t_one
        + 298 * c_one
        + 45 * t_one**2
        - 1.6 * e_squared
        - 3 * c_one**2
    ) * d_val**6 / 720

    lat = footprint_latitude - q_one * (q_two - q_three + q_four)
    return lat


def _calculate_longitude_terms(d_val: float, footprint_latitude: float, central_meridian: float, t_one: float, c_one: float, e_squared: float) -> float:
    """Calculate longitude terms."""
    q_five = d_val
    q_six = (1 + 2*t_one + c_one) * d_val**3 / 6
    q_seven = (
        5
        - 2 * c_one
        + 28 * t_one
        - 3 * c_one**2
        + 8 * e_squared
        + 24 * t_one**2
    ) * d_val**5 / 120

    lon = central_meridian + (q_five - q_six + q_seven) / math.cos(footprint_latitude)
    return lon

def greek_grid_to_wgs84(x: float, y: float) -> tuple:
    """Convert Greek Grid (EPSG:2100) to WGS84 (EPSG:4326)"""

    # Greek Grid parameters
    false_easting = 500000.0
    false_northing = 0.0
    central_meridian = math.radians(24.0)
    scale_factor = 0.9996

    # GRS 1980 ellipsoid parameters
    semi_major_axis = 6378137.0
    flattening = 1 / 298.257222101
    e_squared = 2 * flattening - flattening * flattening

    # Remove false easting/northing
    x -= false_easting
    y -= false_northing

    # Calculate meridional arc
    meridional_arc = y / scale_factor

    footprint_latitude = _calculate_footprint_latitude(meridional_arc, semi_major_axis, e_squared)
    lat, lon = _calculate_latitude_longitude(x, footprint_latitude, central_meridian, scale_factor, semi_major_axis, e_squared)

    return math.degrees(lat), math.degrees(lon)


def create_database(records: List[Dict[str, Any]]) -> None:
    """Create SQLite database with processed flood data"""

    conn = sqlite3.connect('floods_greece.db')
    cursor = conn.cursor()

    # Create floods table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS floods (
            id INTEGER PRIMARY KEY,
            date_of_commencement TEXT,
            year TEXT,
            x_original REAL,
            y_original REAL,
            latitude REAL,
            longitude REAL,
            location_name TEXT,
            flood_event_name TEXT,
            deaths_toll TEXT,
            rainfall_duration TEXT,
            cause_of_flood TEXT,
            rainfall_height TEXT,
            relevant_information TEXT,
            source TEXT,
            col_m TEXT,
            col_n TEXT,
            col_o TEXT,
            col_p TEXT
        )
    ''')

    # Create spatial index
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_floods_location
        ON floods (latitude, longitude)
    ''')

    # Create filter indexes
    cursor.execute(
        'CREATE INDEX IF NOT EXISTS idx_floods_year ON floods (year)')
    cursor.execute(
        'CREATE INDEX IF NOT EXISTS idx_floods_location_name ON floods (location_name)')
    cursor.execute(
        'CREATE INDEX IF NOT EXISTS idx_floods_cause ON floods (cause_of_flood)')

    # Insert data
    processed_count = 0
    for record in records:
        if 'x' in record and 'y' in record and record['x'] and record['y']:
            try:
                # Convert coordinates
                lat, lon = greek_grid_to_wgs84(record['x'], record['y'])

                # Validate coordinates (Greece bounds approximately)
                if 34.0 <= lat <= 42.0 and 19.0 <= lon <= 30.0:
                    cursor.execute('''
                        INSERT INTO floods (
                            id, date_of_commencement, year, x_original, y_original,
                            latitude, longitude, location_name, flood_event_name,
                            deaths_toll, rainfall_duration, cause_of_flood,
                            rainfall_height, relevant_information, source,
                            col_m, col_n, col_o, col_p
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        record['id'],
                        record.get('Date_of_Co', ''),
                        record.get('Year', ''),
                        record['x'],
                        record['y'],
                        lat,
                        lon,
                        record.get('Location_N', ''),
                        record.get('Name_of_Fl', ''),
                        record.get('Deaths_Tol', ''),
                        record.get('Rainfall_D', ''),
                        record.get('Cause_of_F', ''),
                        record.get('Height_of_', ''),
                        record.get('Relevant_i', ''),
                        record.get('Source', ''),
                        record.get('COL_M', ''),
                        record.get('COL_N', ''),
                        record.get('COL_O', ''),
                        record.get('COL_P', '')
                    ))
                    processed_count += 1
            except (ValueError, TypeError, struct.error, IndexError) as e:
                print(f"Error processing record {record['id']}: {e}")
                continue

    conn.commit()
    conn.close()

    print(
        f"Database created successfully with {processed_count} flood records")


def main():
    """Main processing function"""
    shp_file = "Floods_GR.shp"
    dbf_file = "Floods_GR.dbf"

    if not Path(shp_file).exists() or not Path(dbf_file).exists():
        print("Error: Shapefile components not found")
        return

    print("Reading shapefile data...")
    records = read_shapefile_data(shp_file, dbf_file)
    print(f"Read {len(records)} records from shapefile")

    print("Creating database...")
    create_database(records)
    print("Processing complete!")


if __name__ == "__main__":
    main()
