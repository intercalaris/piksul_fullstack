# Pixel Grid Snapper

A full-stack web app for fixing and editing pixel art using Node.js, Express, SQLite, and EJS. Users can upload deformed, blurry, handrawn, or otherwise imperfect pixel art, adjust grid size and color tolerance, and download the snapped image. Saved projects, including original and snapped images with metadata, are managed through a gallery interface.

The app adapts run length encoding and variance analysis to determine the original or "intended" pixel block size and location in deformed or blurry pixel art.

By measuring horizontal and vertical sequences of unchanged color below a tolerance level, it determines the three estimations of pixel dimensions with the least variance (squared difference from the average). It then evaluates these three grid estimations for the most accurate one, comparing and calculating the color variance between estimated cell color and its corresponding section of the original image. 

Currently, the app supports creating projects by uploading images, editing their parameters, and saving them to an SQLite database. Users can view saved projects in a gallery, which displays thumbnails and metadata. Projects can be deleted, removing database entries and image files stored in the data folder. Soon, the app will support updating existing projects by modifying and re-saving metadata and images.

Future plans include adding user authentication to tie projects to specific accounts, hosting project data and images on a cloud platform, and enhancing the snapping algorithm for better results. Collaboration features like sharing and voting on pixel art projects will also be introduced.

To run locally, clone the repository, install dependencies using `npm install`, and start the server using `node server.js`. Access the app at `http://localhost:3000`.

CRUD OPERATIONS:
For the full list of current crud operations, open server.js

